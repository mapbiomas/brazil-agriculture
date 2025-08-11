<div>
    <img src='../../../assets/new_logo.png' height='auto' width='200' align='right'>
    <h1>Citrus</h1>
</div>

Developed by ***Remap Geotecnologia Ltda***.

## About

This folder contains the scripts to classify and post-process the **Citrus** subclass. 

We recommend that you read the [Agriculture Appendix of the Algorithm Theoretical Basis Document (ATBD)](https://mapbiomas.org/download-dos-atbds), since important informations about the citrus classification methodology can be found in there. 

## How to use

### UNET Training

Copy the [training notebook](./01_unet_training_pipeline.ipynb.ipynb) to your Google Drive, open it in Google Colab and follow the instructions there.

### UNET Inference

Copy the [inference notebook](./02_unet_inference_pipeline.ipynb.ipynb) to your Google Drive, open it in Google Colab and follow the instructions there.

### Post-processing
    
To run the post-processing, follow these steps:

1. Download the raw results from your Google Drive;

2. Upload the classification results to a Google Earth Engine image collection;

3. You must set a `year` property to every classification result you uploaded, with it's respective year;

4. Open the script **agriculture/citrus/03_spatial_temporal_filter.js**;

5. On **line 17** (variable `filters`), set the path to the [temporal_spatial_filters.js](../../../utils/temporal_spatial_filters.js) script you copied to your GEE account;

6. On **line 23** (variable `input`), set the path to the raw classification result;

7. On **line 26** (variable `output`), set the path for the filtered result;

8. Run the script.