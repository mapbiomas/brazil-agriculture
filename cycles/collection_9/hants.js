/**********************************************************************
The Harmonic ANalysis of Time Series (HANTS) was proposed by Verheof (1996) and Menenti et al. (1993)
to reconstruct time series of remote sensing products such as NDVI and LAI.
The algorithm had been widely used in the remote sensing community and implemented 
in Fortran, IDL/ENVI, Matlab, C, and Python.   
The script in this file aim to implement the HANTS in GEE, which can avoid 
donwloading large volume dataset to local PC and also make full use of the 
powerfull computation resource of GEE.

 - Original code found in: https://github.com/jiezhou87/HANTS-GEE?tab=readme-ov-file
 - Paper for the GEE implementation: https://www.tandfonline.com/doi/full/10.1080/17538947.2023.2192004
 
 - Modified by: paulo.teixeira@remapgeo.com
**********************************************************************/


var hants = function(imgCol, numHarm, fet, hilo, newOut, coefficients,dod, maxIter, dependent){
    /**
     * Performs Harmonic Analysis of Time Series (HANTS) on an image collection to 
     * reconstruct and model time series data by fitting harmonic functions. 
     * It detects and masks outliers iteratively and produces a refined time series.
     * 
     * @param {ee.ImageCollection} imgCol - The input time-series ImageCollection to process.
     * @param {number} [numHarm=4] - The number of harmonic terms used in the fitting process.
     * @param {number} [fet=0.05] - The fitting error tolerance threshold for outlier detection.
     * @param {string} [hilo='Low'] - The outlier detection mode. Either 'Low' to detect low outliers, 
     *                                or 'High' to detect high outliers.
     * @param {Object} [newOut] - An object that defines the output interval.
     * @param {number} [newOut.interval] - The time interval for output timestamps.
     * @param {Object} [coefficients] - An object to store the harmonic trend coefficients.
     * @param {number} [dod=5] - Degrees of freedom for model robustness. Default is 5.
     * @param {number} [maxIter=10] - The maximum number of iterations for outlier detection.
     * @param {string} dependent - The dependent variable or signal to be modeled (e.g., 'NDVI').
     * 
     * @returns {ee.ImageCollection} A new ImageCollection with the fitted harmonic model and
     *                               outlier-masked data. Includes a 'fitted' band with 
     *                               the reconstructed signal and a 'fitted1' band where gaps are filled.
    **/
    
      if(numHarm===undefined){numHarm=4}
      if(fet===undefined){fet=0.05}
      if(hilo===undefined){hilo='Low'}
      if(dod===undefined){dod=5 }
      if(maxIter===undefined){maxIter=10}
      
      // The dependent variable we are modeling, i.e the orignal signals to be processed.
      // var dependent = 'dependentBand';
      
      // The number of cycles per year to model.
      var harmonics = numHarm;
      
      // Make a list of harmonic frequencies to model.
      // These also serve as band name suffixes.
      // by "cat([0.5])" a harmonic with double periods of base period is used to account
      // trends within the base period.
      var harmonicFrequencies = ee.List.sequence(1, harmonics).cat([0.5]);
      
      //print(harmonicFrequencies);
      
      // Function to get a sequence of band names for harmonic terms.
      var constructBandNames = function(base, list) {
        return ee.List.sequence(1,(list.length())).map(function(i) {
          return ee.String(base).cat(ee.Number(i).int());//
        });
      };
      
      // Construct lists of names for the harmonic terms.
      var cosNames = constructBandNames('cos_', harmonicFrequencies);
      var sinNames = constructBandNames('sin_', harmonicFrequencies);
      
      // Independent variables.
      var independents = ee.List(['constant'])
        .cat(cosNames).cat(sinNames);//.cat(['poly1','poly2']);
      
      
      // Function to add a time band.
      var addDependents = function(image) {
        // Compute time in fractional years since the epoch.
        var years = image.date().difference('2006-01-01', 'year');
        var timeRadians = ee.Image(years.multiply(2 * Math.PI)).rename('t');
        var constant = ee.Image(1);
        //var poly1 = ee.Image(years.pow(2)).rename('poly1');
        //var poly2 = ee.Image(years.pow(3)).rename('poly2');
        return image.addBands(constant).addBands(timeRadians.float());
                    //.addBands(poly1.float()).addBands(poly2.float());
      };
      
      // Function to compute the specified number of harmonics
      // and add them as bands.  Assumes the time band is present.
      var addHarmonics = function(freqs) {
        return function(image) {
          // Make an image of frequencies.
          var frequencies = ee.Image.constant(freqs);
          // This band should represent time in radians.
          var time = ee.Image(image).select('t');
          // Get the cosine terms.
          var cosines = time.multiply(frequencies).cos().rename(cosNames);
          // Get the sin terms.
          var sines = time.multiply(frequencies).sin().rename(sinNames);
          return image.addBands(cosines).addBands(sines);
        };
      };
      
      //Compute fitted values and residual for a image
      var fitName = 'fitted';
      var hiloflag = hilo==='Low'?1:-1;
      var imgfit = function(harmonicTrendCoefficients){
        return function(img) {
            
              //update the fitted value band
              var fitted = 
                img.select(independents)
                  .multiply(harmonicTrendCoefficients)
                  .reduce('sum')
                  .rename(fitName);
              
              //update the residual band
              var residual = fitted.subtract(img.select(dependent));//.subtract(fitted);
              
              //Update the mask of original NDVI band.
              /*During the iteration, we should only update the mask of raw NDVI observation 
              but keep all other band un-effected.
              */
              var unChangedMask = img.mask().select(img.bandNames().remove(dependent));
              //this is the new mask for the raw NDVI.
              var dependentMask = residual.multiply(hiloflag).lt(ee.Image.constant(fet)).select([0],[dependent]);
              //prevent pixels without enough valid observation from further outlier removing
              dependentMask=dependentMask.or(mask1).rename(['mask']);
              var mask = ee.Image.cat(dependentMask, unChangedMask);
                
              return img.updateMask(mask).addBands(fitted,[fitName],true)
                        .addBands(dependentMask,['mask'],true);
                        //.addBands(residual.rename(['residual']),null,true);
            
          };
      };
      // add all variables.
      var reconCol = imgCol
        .map(addDependents)
        .map(addHarmonics(harmonicFrequencies));
        /*.map(function(img){
          var fittedImg = ee.Image(0).rename("fitted");
          return img.addBands(fittedImg);
        });*/
      
        
      
      //maximum number of iterations
      maxIter = hilo==='None'?1:maxIter;// if no biased outlier in the time series, 
                                           //only one iteration is applied to smooth the series.
      var independents1=independents.remove('constant');
      
      
      
      var minObs=(numHarm+1)*2+1+dod; 
      //var validCount=reconCol.select(dependent).count();
      
      
      //mask for pixel without enough valid observations, the reconstruction result of these pixels shoud be filled with invalid value(99999 by default).
      //var mask1=validCount.lt(minObs);
      //Map.addLayer(mask1, {palette: ['00FFFF', '0000FF']},'initial validobs count');
      
      //regression iteration
      while(maxIter){
        
         //mask out pixels without enough valid observations (i.e. valid obs. < 12)
        var validCount = reconCol.select(dependent).count();
        var mask1=validCount.lt(minObs);//counting valid observations for each pixel during current iteration.
        //Map.addLayer(validCount, {palette: ['00FFFF', '0000FF']},'validobs count');
        
        // The output of the regression reduction is a 4x1 array image.
        var harmonicTrend = reconCol
          .select(independents1.add(dependent))
          .reduce(ee.Reducer.ridgeRegression(independents1.length(), 1,0.5),16);
          //.reduce(ee.Reducer.robustLinearRegression(independents.length(), 1),16);
        
        //print(independents1)
        // Turn the array image into a multi-band image of coefficients.
        var harmonicTrendCoefficients = harmonicTrend.select('coefficients')
          .arrayProject([0])
          .arrayFlatten([independents]);
    
        // Compute fitted values and update the mask.
        reconCol = reconCol.map(imgfit(harmonicTrendCoefficients));
        
        //var argmax=reconCol.select('residual').toBands().arrayArgmax();
        //print(argmax)
    
       
        maxIter--;
      }
      
       
      //processing the user-defined output interval (timestamps)
      if (newOut!==undefined &newOut!==null){
        
        //composite output timestamps based on the given interval
        var interval =newOut.interval;
        var startDate=ee.Image(imgCol.sort('system:time_start').first()).date();
        var endDate=ee.Image(imgCol.sort('system:time_start',false).first()).date().advance(30,'day');
        var voidimglist = ee.List.sequence(0, endDate.difference(startDate,'day'),interval)
                  .map(function(d){
                    return ee.Image().set('system:time_start',startDate.advance(d,'day').millis())
                                      .rename(['void'])
                                      .set('system:index',startDate.advance(d,'day').format('YYYY-MM-dd'));
                  });
        //compute indepandent variables at new timestamps.  
        var outIndependentCol = ee.ImageCollection(voidimglist)
                          .map(addDependents)
                          .map(addHarmonics(harmonicFrequencies));
        //compute final result Imagecollection.
        var newreconCol = outIndependentCol.map(function(img){
          return img.select(independents)
                  .multiply(harmonicTrendCoefficients)
                  .reduce('sum')
                  //.clamp(-1,1)
                  .rename('fitted') 
                  //.addBands(ee.Image().rename('raw'))
                  //.addBands(ee.Image().rename(fitName))
                  .set('system:time_start',img.get('system:time_start'));
        });
        
        newOut.outReconCol= newreconCol;
        
        
      }
      //print(harmonicTrendCoefficients);
      if (coefficients !== undefined){
        coefficients.numHarm = numHarm;
        coefficients.coef = harmonicTrendCoefficients;
      }
      
      //add another 'fitted1' band which return result with all outliers replaced by value in 'fitted',
      //but keep other pixels unchanged. In this case, only gaps were filled by HANTS.
      reconCol=reconCol.map(function(img){
        var imgr=img.select(dependent);
        var mask=imgr.mask();
        imgr=imgr.unmask(0);
        return img.addBands(imgr.add(img.select('fitted').multiply(ee.Image(1).subtract(mask)))
                    .select([0],['fitted1']),['fitted1']);
        
      });
      
      return reconCol;
    };
    
    
    exports.hants = hants
    
    
    
    
    
    // EXAMPLE
    // var col = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
    //   .filter(ee.Filter.and(
    //     ee.Filter.eq('MGRS_TILE', '23LLF'),
    //     ee.Filter.date('2021-10-01','2022-09-30')
    //     ))
    //   .map(function(image){
    //     return image.addBands(image.expression('2.5 * ((NIR - RED) / (NIR + 2.4*RED + 1))', {
    //       'NIR': image.select('B8'),
    //       'RED': image.select('B4')
    //     }).rename('EVI2')).unmask(0, false)
    //   })
    //   .select(['EVI2'])
    
    // var harmonics = 5
    // var fet = 0.15
    // var hilo = 'Low'
    // var dod = 5
    // var maxIter = 2
    // var coeficient = {numHarm:null,coef:null}
    // var newOut = {  
    //   interval: 5,
    //   outReconCol: null 
    //   };
      
    // var smoothed = hants(col, harmonics, fet, hilo, newOut, coeficient, dod, maxIter, 'EVI2')
    
    // Map.addLayer(col.select('EVI2'), {}, 'EVI2 Time Series', false)
    // Map.addLayer(smoothed.select('fitted'), {}, 'HANTS Time Series', false)
    
    // print('Smoothed Time-Series', smoothed, 'Use the inspector to see the difference between the original and fitted time series')
    
    // var feat = ee.Feature({"type": "Feature", "geometry": {"type": "Polygon","coordinates": [[[  -46.84895217322564,  -13.649995056125121],[  -46.78551809986819,  -13.650337246295475],[  -46.72208407971885,  -13.650679473126266],[  -46.65864996754155,  -13.651021700544167],[  -46.59521591464863,  -13.651363955809105],[  -46.531781852727015,  -13.651706218014128],[  -46.468347788755594,  -13.652048412839159],[  -46.404913731253046,  -13.652390672564284],[  -46.34147969027809,  -13.652732922084283],[  -46.27804567742979,  -13.65307515495681],[  -46.2146115598487,  -13.653417401035277],[  -46.15117749859374,  -13.653759616335405],[  -46.08774350988661,  -13.654101861987455],[  -46.0243093933479,  -13.654444081677795],[  -45.96087538699525,  -13.654786315217308],[  -45.89744129410554,  -13.655128573985396],[  -45.834007282779936,  -13.655470812459109],[  -45.83064065171481,  -12.6626965780439],[  -45.89382277378943,  -12.662379976518046],[  -45.957004842223654,  -12.662063359807702],[  -46.020186983717466,  -12.66174675927012],[  -46.083369108864346,  -12.661430160823354],[  -46.146550108852566,  -12.661113544194563],[  -46.20973113348917,  -12.660796946197523],[  -46.272912097711384,  -12.660480351719322],[  -46.33609313716132,  -12.660163790147665],[  -46.39927519579821,  -12.659846023395948],[  -46.46245731641184,  -12.659528352883758],[  -46.52563949345538,  -12.659210640592136],[  -46.58882157580725,  -12.65889292287523],[  -46.652002602994166,  -12.658576371469472],[  -46.71518360228474,  -12.658259758570887],[  -46.778364574009714,  -12.657943149369776],[  -46.841545593964334,  -12.65762655518751],[  -46.84524885855018,  -13.15381080129693],[  -46.84895217322564,  -13.649995056125121]]]}})
    
    // Map.addLayer(feat, {}, 'Test Area')
    