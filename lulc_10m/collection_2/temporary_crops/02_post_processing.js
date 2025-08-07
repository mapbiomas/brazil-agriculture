var filters = require("users/your_user/utils:temporal_spatial_filters.js");

var temporal = filters.temporal;
var spatial = filters.spatial;


/*****import collections*******/

var raw_col = ee.ImageCollection('projects/your_project/assets/your_img_collection')
  .map(function(img){
    return img.set('year', ee.Number.parse(img.getString('system:index').split('_').get(2)))
              .rename(['classification']).cast({'classification': 'int8'})
  })


/*****end import collections*******/


var first_year = ee.Number(raw_col.aggregate_min('year'))
var last_year = ee.Number(raw_col.aggregate_max('year'))

var filteredCollection = raw_col

var new_first = filteredCollection.filter(ee.Filter.eq('year', first_year)).mosaic().unmask()
                                  .or(filteredCollection.filter(ee.Filter.eq('year', first_year.add(1))).mosaic().unmask())
                                  .set('year', first_year)
                                  

var new_last = filteredCollection.filter(ee.Filter.gte('year', last_year.subtract(1))).max().unmask()
                                  .set('year', last_year)

filteredCollection = filteredCollection.filter(ee.Filter.inList('year', [first_year, last_year]).not())
                                        .merge(ee.ImageCollection([new_first, new_last]))
                                        .sort('year')


// base filter
var filtersToApply = [
  spatial.build(spatial.minConnnectedPixels(36)),
  temporal.build(temporal.getMovingWindow(first_year.add(1), last_year.subtract(1), 3), temporal.thresholdFilter(2)),
  spatial.build(spatial.minConnnectedPixels(36)),
]

var filteredCollection = filters.applyFilters(filtersToApply, raw_col);

// filter to correct omission in the first and last year



// filter to only allow expansion when it also happens in the next year
filteredCollection = ee.ImageCollection(ee.List.sequence(last_year.subtract(1), first_year, -1).iterate(function(year, col){
  year = ee.Number(year).int()
  col = ee.ImageCollection(col)
  
  var current = col.filter(ee.Filter.eq('year', year)).sum()
  var after = col.filter(ee.Filter.eq('year', year.add(1))).sum()
  
  return col.filter(ee.Filter.neq('year', year))
            .merge(current.updateMask(after.unmask(0, false)).set('year',year))
}, filteredCollection)
).sort('year')


filteredCollection = filters.applyFilters([spatial.build(spatial.minConnnectedPixels(36))], filteredCollection);



// filter to correct omission in the first and last year
var new_first = filteredCollection.filter(ee.Filter.eq('year', first_year)).mosaic().unmask()
                                  .or(filteredCollection.filter(ee.Filter.eq('year', first_year.add(1))).mosaic().unmask())
                                  .set('year', first_year)
                                  

var new_last = filteredCollection.filter(ee.Filter.eq('year', last_year.subtract(1))).mosaic().unmask()
                                  .blend(filteredCollection.filter(ee.Filter.eq('year', last_year)).mosaic().unmask()).gte(1)
                                  .set('year', last_year)

filteredCollection = filteredCollection.filter(ee.Filter.inList('year', [first_year, last_year]).not())
                                        .merge(ee.ImageCollection([new_first, new_last]))
                                        .sort('year')



/////

var raw = filters.toBandsByYear(raw_col)
var filtered = filters.toBandsByYear(filteredCollection)


// Visualization and Exports


var year = 2022
var version = 11
var class_name = 'temp_crops'

var filename = class_name+'_s2_FT_v'+version

Export.image.toAsset({
     image: filtered.clip(brasil).byte(), 
     description: filename, 
     assetId: 'projects/your_project/assets/'+filename,
     region: filtered.geometry(), 
     scale: 10, 
     maxPixels: 1e13
   })


