# newman-flow-data
data wrangling for Flow sensor data

## [How do I export my Flow data?](https://plumelabs.zendesk.com/hc/en-us/articles/360025094573-How-do-I-export-my-Flow-data-)

Note: *You must have updated your Flow App to at least version V1.2.0 (iOS) / V1.3.00 (Android)*

You can export your entire data history right from the application! Follow these steps to have your Flow data sent right to your account email address. You'll receive a zip file containing a set of .csv files with your pollution measures, and a set with your GPS data. Every measure is timestamped and is expressed in Plume AQI and in ppb or µg/m³.

| timestamp | date | NO2 (ppb) | VOC (ppb) | pm 10 (ug/m3) | pm25 (ug/m3) | NO2 (Plume AQI) | VOC (Plume AQI) | pm 10 (Plume AQI) | pm 25 (Plume AQI) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1540905674 | 2020-01-01 00:00:00 | 15.292587280273 | 4946 | 14 | 7 | 14 | 147 | 14 | 14 |

Please remember that your Flow data may contain GPS information so be careful about how you share it!

## Data Ingest Notes

* coordinates for measurements are interpolated (linear) from position data
* coordinates values are retained with enough precision to locate measurement within a few meters
* measurements are rounded to the nearest integer
* measurements consisting of missing particulate matter values and zero NO₂ and VOC values are discarded
* only a single set of measurements for a given time and place are stored
* NO₂ and VOC measurements stored with units ppb (parts per billion)
* pm10, pm2.5 & pm1 measurements stored with units μg/m³ (micrograms per cubic meter)

## Dependencies

* [@robireton/chrono](https://www.npmjs.com/package/@robireton/chrono)
* [adm-zip](https://www.npmjs.com/package/adm-zip)
* [better-sqlite3](https://www.npmjs.com/package/better-sqlite3)
* [express](http://expressjs.com/)
* [express-fileupload](https://www.npmjs.com/package/express-fileupload)
* [express-handlebars](https://www.npmjs.com/package/express-handlebars)
* [serve-favicon](https://www.npmjs.com/package/serve-favicon)
* [uuid](https://www.npmjs.com/package/uuid)

## Perspective

![Coordinate Precision](https://imgs.xkcd.com/comics/coordinate_precision.png "Coordinate Precision")
