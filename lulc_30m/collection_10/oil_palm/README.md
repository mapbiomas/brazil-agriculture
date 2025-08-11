<div>
    <img src='../../../assets/new_logo.png' height='auto' width='200' align='right'>
    <h1>Oil Palm</h1>
</div>

Developed by ***Remap Geotecnologia Ltda***.

## About

This folder contains the scripts to classify and post-process the **Oil Palm** subclass. 

We recommend that you read the [Agriculture Appendix of the Algorithm Theoretical Basis Document (ATBD)](https://mapbiomas.org/download-dos-atbds), since important informations about the oil palm classification methodology can be found in there. 

## How to use

### UNET Training

Copy the [training notebook](./01_unet_training_pipeline.ipynb.ipynb) to your Google Drive, open it in Google Colab and follow the instructions there.

### UNET Inference

Copy the [inference notebook](./02_unet_inference_pipeline.ipynb.ipynb) to your Google Drive, open it in Google Colab and follow the instructions there.

### Post-processing
    
Post-processing is mostly for filtering a time-series of classifications.To run the post-processing, follow these steps:

1. Download the raw results from your Google Drive.

2. Upload the classification results to a Google Earth Engine, image collection. You must set a `year` property to every classification result you uploaded, with it's respective year;

3. Open the script **agriculture/oil_palm/03_spatial_temporal_filter.js**;

4. On **line 17** (variable `filters`), set the path to the [temporal_spatial_filters.js](../../../utils/temporal_spatial_filters.js) script you copied to your GEE account;

5. On **line 23** (variable `collection`), set the path to the raw classification result;

6. On **line 26** (variable `output_collection`), set the path for the filtered result;

8. Run the script.