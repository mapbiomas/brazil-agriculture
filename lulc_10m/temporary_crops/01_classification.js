// IMPORTS


var grid_landsat = ee.FeatureCollection("users/mapbiomas1/PUBLIC/GRIDS/BRASIL_COMPLETO_PEAK")
                    .filter(ee.Filter.eq('AC_WRS', 1))
                    
var grid_cartas = ee.FeatureCollection('users/mapbiomas1/PUBLIC/GRIDS/GRID_CARTAS_MOSAIC_DATES')
                    .filterBounds(grid_landsat)


var collection = ee.ImageCollection('projects/your_project/assets/your_mosaic')

var selected_tiles = collection.filter(ee.Filter.eq('year', 2023)).aggregate_array('grid_name')
                                .filter(ee.Filter.inList('item', grid_cartas.aggregate_array('grid_name')))
                                .getInfo()


var years = [2020,2019,2018,2017,2016]
var version = 1

  
years.forEach(function(year){
  
  
  
  selected_tiles.forEach(function(tile_name){
    
    var tile = ee.Feature(grid_cartas.filter(ee.Filter.eq('grid_name', tile_name)).first())
    
    
                      
    var year_collection = collection
    .filter(ee.Filter.eq('version', '1'))
    .filter(ee.Filter.eq('year', year))
    .filter(ee.Filter.eq('grid_name', tile_name))
    .mosaic()
    
    
    var samples = ee.FeatureCollection('projects/your_project/assets/your_samples')
                                      .filterBounds(tile.geometry().buffer(10000))
    
    var classifier = ee.Classifier.smileRandomForest(100)
          .train(samples, 'class', year_collection.bandNames());
          
    var classifier_prob = classifier.setOutputMode('MULTIPROBABILITY')
    var classified_prob = year_collection.classify(classifier_prob)
    var img = classified_prob.multiply(100).uint8()
    
    var classes = ee.Dictionary({
      0: 'others',
      1: 'soybean',
      2: 'other_temp_crops',
      3: 'cotton'
    })
    
    var null_img = ee.Image.constant([0,0,0,0]).rename(classes.values()).int8()
    var n = ee.Number(img.arrayLength(0).reduceRegion(ee.Reducer.first(), tile.geometry().centroid(), 30).get(img.bandNames().get(0)))
    var names = classes.values().slice(0, n)  
    
    var out = img.arrayFlatten([names]).addBands(null_img, null_img.bandNames().removeAll(names)).select(null_img.bandNames()).selfMask()
      .set({
        'grid_name': tile_name,
        'year': year,
        'version': version
      })
    

    var filename = 'classification_temp_multiprob_s2_' + year + '_' + tile_name + '_'+version       

    Export.image.toAsset({
      image: out, 
      description: filename, 
      assetId: 'projects/your_project/assets/your_img_collection/' + filename, 
      region: tile.geometry(), 
      scale: 10, 
      maxPixels: 1.0E13
    })


    
 
  }) //end tiles


}) //end years



