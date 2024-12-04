
// packages
var hants = require('users/paulo_teixeira/packages:hants.js').hants


// function to get the position of the valleys in a time-series
var detectPeaksAndValleys = function(col, min_difference, min_peak) {
  
  if (min_difference === undefined) { min_difference = 0 }
  if (min_peak === undefined) { min_peak = 0 }
  
  col = col.map(function(img){ return img.set('day', ee.Date(img.get('system:time_start')).format('YYYYMMdd'))})
  col = ee.ImageCollection(col.distinct('day'))
  
  var image = col.toBands()
  var arr_image = image.toArray()
  var names = image.bandNames()
  
  var dates = ee.ImageCollection(col.map(function(img){
    return ee.Image.constant(img.date().millis().int64())
  })).toBands().rename(names)
  
  // Compute the forward and backwards difference.
  // Note: these arrays are 1 smaller than the input 
  // because the first/last pt doesn't have a prev/next neighbor.
  var left = arr_image.arraySlice(0, 0, -1)
  var right = arr_image.arraySlice(0, 1)
  var fwd = left.subtract(right)
  var back = right.subtract(left)
  
  // Test if each position is greater than its next/prev neighbor?
  var next = fwd.gt(0)
  var prev = back.gt(0)
    
  // Test if the first/last point is itself a peak
  var first = arr_image.arrayGet([0]).gt(arr_image.arrayGet([1])).toArray()
  var last = arr_image.arrayGet([-1]).gt(arr_image.arrayGet([-2])).toArray()
  
  // Reattach the end points.
  next = next.arrayCat(last, 0)
  prev = first.arrayCat(prev, 0)
 
  // Set to 1 when both next and prev are greater than 0 and get the result. 
  // Results in an array with the position of the valleys
  var valley = (next.not()).and(prev.not()).arrayProject([0]).arrayFlatten([names])
  var peaks = (next.and(prev)).arrayProject([0]).arrayFlatten([names])

  // Set the values in positions detected as valleys and peaks back to image input value.
  var valley_values = ee.Image.constant(ee.List.repeat(0, names.size()))
                        .where(valley, image).selfMask().rename(names)
  var peaks_values = ee.Image.constant(ee.List.repeat(0, names.size()))
                        .where(peaks, image).selfMask().rename(names)      
                        
  // Calculates the difference between each peak and the the valley after. Results in the value change between each peak and the next valley.
  // The first and last image will never be considered a peak, even if it was identified before, because it is impossible to know the values outside the series. 
  var peak_diff_to_valley = ee.ImageCollection(
    ee.List([ee.Image.constant(0)])
    .cat(names.slice(1,-1).map(function(band_name){
      
      var img = peaks_values.select([band_name])
      var mask = img.gte(min_peak)
      var after = valley_values.select(names.slice(names.indexOf(band_name).add(1)))
      //var before = valley_values.select(names.slice(0, names.indexOf(band_name)))
      
      var condition_after = ee.Image.constant(0).where(mask, after.reduce(ee.Reducer.firstNonNull()).subtract(img)).abs()
      //var condition_before = ee.Image.constant(0).where(img, before.reduce(ee.Reducer.lastNonNull()).subtract(img)).abs()
      
      return condition_after
              //.max(condition_before)
              .float()
    
    })).add(ee.Image.constant(0))
  ).toBands().rename(names).gte(min_difference)
  
  var valley_dates = ee.Image.constant(ee.List.repeat(0, names.size())).where(valley, dates).rename(names)
  //var peaks_diff = ee.Image.constant(ee.List.repeat(0, image.bandNames().size())).where(peaks, valley_to_peak_difference.gte(min_difference))
  
  var filtered_valleys = ee.ImageCollection(
    ee.List([ee.Image.constant([0,0,0]).rename(['peak', 'valley_before', 'valley_after']).int64().selfMask()])
    .cat(names.slice(1,-1).map(function(band_name){
    
      var img = peak_diff_to_valley.select([band_name])
      var date = ee.Image(0).where(img, dates.select([band_name]))
      
      var filter_before = valley_values.select(names.slice(0, names.indexOf(band_name))).subtract(img).abs().gte(min_difference).selfMask()
      var filter_after = valley_values.select(names.slice(names.indexOf(band_name).add(1))).subtract(img).abs().gte(min_difference).selfMask()
      
      var dates_before = valley_dates.select(names.slice(0, names.indexOf(band_name))).updateMask(filter_before)
      var dates_after = valley_dates.select(names.slice(names.indexOf(band_name).add(1))).updateMask(filter_after)
      
      var date_before = ee.Image.constant(0).where(img, dates_before.reduce(ee.Reducer.lastNonNull()))
      var date_after = ee.Image.constant(0).where(img, dates_after.reduce(ee.Reducer.firstNonNull()))
      
      return date.addBands([date_before, date_after]).rename(['peak', 'valley_before', 'valley_after']).int64().selfMask()
    })
    ).add(ee.Image.constant([0,0,0]).rename(['peak', 'valley_before', 'valley_after']).int64().selfMask())
  )
  
  
  return filtered_valleys
}


/**/

//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
//                                             INPUTS
//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

/**/

var sentinel_grid = ee.FeatureCollection('projects/mapbiomas-workspace/AUXILIAR/SENTINEL2/grid_sentinel')
  .filter(ee.Filter.inList('NAME', ['21LXG']))

// agriculture mask
var integration = e.Image('projects/mapbiomas-public/assets/brazil/lulc/collection_S2_beta/collection_LULC_S2_beta').eq(19).reduce(ee.Reducer.sum()).gte(1)

var version = 1

// select your output ImageCollection
var output_path = 'projects/your_project/assets/yout_path'

// select target years
var years = [2021]

// cycle detection parameters
var min_difference = 0.7
var min_peak = 1

var priority = 100

// empty collections for later use
var col_plot = ee.ImageCollection([])

/**/


//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
//                                         LOOP FOR YEARS AND OP
//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

/**/


years.forEach(function(year){
  
  var done_scenes = ee.ImageCollection(output_path)
    .filter(ee.Filter.eq('version', version))
    .filter(ee.Filter.eq('year', year))
    .aggregate_array('scene')
    
  var op = sentinel_grid.aggregate_array('NAME').removeAll(done_scenes).getInfo()
  print(op)

  op.forEach(function(pathrow){

    var tile = sentinel_grid.filter(ee.Filter.eq("NAME", pathrow)).first()
    var roi = tile.geometry()
    
    var mask_roi = ee.Image(1).clip(roi)    
    
    var startDate = ee.Date.fromYMD(year-1, 9, 1)
    var endDate = ee.Date.fromYMD(year, 8, 31)
    
    var buffer_start_date = startDate.advance(-1, 'month')
    var buffer_end_date = endDate.advance(1, 'month')

    
    // filtering the Landsat collection
    var full_collection = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                        .filter(ee.Filter.and(
                          ee.Filter.bounds(roi),
                          // ee.Filter.bounds(roi.centroid()),
                          ee.Filter.eq('MGRS_TILE', pathrow),
                          ee.Filter.date(buffer_start_date, buffer_end_date)
                          ))
                        // .map(maskS2clouds)
                        .map(function(image){
                          // EVI2 calculation
                          return image.addBands(image.expression('2.5 * ((NIR - RED) / (NIR + 2.4*RED + 1))', {
                            'NIR': image.select('B8'),
                            'RED': image.select('B4')
                          }).rename('EVI2')).unmask(0, false)
                        })
                        .select(['EVI2'])
    
    var out = ee.List([])

    var orbits = full_collection.aggregate_array('SENSING_ORBIT_NUMBER').distinct().getInfo() 
        orbits.forEach(function(orbit){
          var collection = full_collection.filter(ee.Filter.eq('SENSING_ORBIT_NUMBER', orbit))
          
          var harmonics=5
          var fet = 0.15
          var hilo= 'Low'
          var dod=5
          var maxIter=2
          var coeficient = {numHarm:null,coef:null}
          var newOut={
            interval:5,
            outReconCol:null 
          };
          
          var harmonizedCollection = hants(collection,harmonics,fet,hilo,newOut,coeficient,dod,maxIter, 'EVI2') 
          
          // get an output of an image array of equal size to the collection, where every valley in the curve has a value of 1
          var inflexions = detectPeaksAndValleys(harmonizedCollection.select('fitted'), min_difference, min_peak)

          var peak_img = inflexions.select('peak')

          // get the number of peaks in a pixel by the sum of the image
          var n_peaks = peak_img
            .map(function(img){
              return img.updateMask( img.gte(ee.Image.constant(startDate.millis())).and(img.lte(ee.Image.constant(endDate.millis()))) )
            })
            .reduce(ee.Reducer.countDistinctNonNull())
            .updateMask(integration)
          
         
          out = out.add(n_peaks)
          col_plot = col_plot.merge(harmonizedCollection.combine(collection.select(['EVI2'], ['EVI2_original'])))
          
      })

    var dict = {
      'scene': pathrow,
      'version': version,
      'year': year,
      'min_difference': min_difference,
      'min_peak': min_peak
    }
    
    out = ee.ImageCollection.fromImages(out).max()
      .set(dict)
    
    var filename = ''+year+'_'+pathrow+'_'+version
    Export.image.toAsset({
      image: out.selfMask(),
      description: 'AGRI_FREQ_'+filename,
      assetId: output_path+'/'+filename,
      region: roi,
      scale: 10,
      maxPixels: 1e13,
      priority: priority
    })


  })
 
}) //end years

