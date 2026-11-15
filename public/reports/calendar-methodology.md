# Burning Activity Calendar — methodology

The calendar sums only existing imported cell-month counts. It downloads no new observations. It uses the globe's exact source-country mappings and scoped rows, selected archive/year, source day/night labels and MODIS platform filter. Month buttons filter the globe; the calendar retains all months for context. Layer switches control map visibility only.

The six count fields are Terra day, Terra night, Aqua day, Aqua night, Suomi-NPP day, Suomi-NPP night. MODIS and VIIRS are displayed separately on one linear count scale. Source month is based on acquisition date in UTC. There is no daily resolution in these browser aggregates. Worldwide cells are 1° geographic cells; whole-Australia cells are 25 km equal-area cells. Counts are summed without spatial interpolation.

A zero is zero retained detections within a loaded sensor archive and selected filters. An absent mapped sensor source is “Not loaded”, not zero. Source-file presence does not establish complete monthly observation coverage. For grouped territories, only the imported source members contribute; NASA country assignment is retained. Worldwide totals include imported country-assigned records, not complete ocean/unassigned coverage.

## Verified local evidence

- `tools/prepare_history.py`: verifies four ZIP SHA-256 hashes, filters type 0, MODIS confidence >=30, VIIRS confidence n/h, preserves sensor source membership even when no rows survive, and reconciles aggregate counts.
- `public/reports/history-coverage.json`: all 413 MODIS country/year entries report version `6.03`; all 437 VIIRS entries report version `2`. These counts are source-file audit entries, not fire counts.
- `public/reports/history-validation.json`: archive URLs, hashes, country mappings and retained totals.
- `tools/prepare_globe_data.py` and `public/data/globe-observations.json`: whole-Australia filter period is September 2019–March 2020; versions also report 6.03 and 2.
- Original worldwide archive is MODIS-only; VIIRS remains unavailable there.

These active-fire CSV version labels do not establish a processing build, monthly-product identifier, or whether a specific VIIRS C2 reprocessing correction is included. No claim that these files are affected or corrected is supported by this metadata. No reprocessing correction is applied.

MODIS numeric confidence and VIIRS low/nominal/high classes are different algorithm outputs, not interchangeable probabilities. Counts are hotspot observations, not unique fires, burned area, accuracy or observation-adjusted trends. Cloud and valid-observation masks are absent. No harmonized series is generated.

## Official NASA references

- [FIRMS country archives](https://firms.modaps.eosdis.nasa.gov/country/)
- [FIRMS archive download tool](https://firms.modaps.eosdis.nasa.gov/download/)
- [VIIRS active-fire attributes, versions and confidence](https://firms.modaps.eosdis.nasa.gov/content/descriptions/FIRMS_VIIRS_Firehotspots.html)
- [MODIS active-fire attributes](https://firms.modaps.eosdis.nasa.gov/content/descriptions/FIRMS_MODIS_Firehotspots.html)
