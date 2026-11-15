# FireTrace design brief

Purpose: let a researcher inspect historical satellite hotspot observations and understand why MODIS and VIIRS differ.
Context: working analytical prototype, not an emergency alerting service.
Directions considered: editorial field journal; industrial monitoring console; dense analyst workspace. Chosen: dense analyst workspace with an editorial hierarchy.
Visual system: deep forest rail and geographic surface; warm white content; burnt-orange MODIS and turquoise VIIRS; fine mineral borders; readable sans body and monospaced numeric metadata. Primary differentiator: actual observations on a restrained geographic plot paired with visible scientific limitations.
Core workflow: explore period and day/night → toggle sensor observations → inspect data counts → compare platform timing → read provenance and download derived data.
Constraints: source MODIS C6 6.03 must be named; no calibrated output or fire-event counts; source type/confidence filters disclosed; local reproducible data build; responsive and keyboard-accessible controls; all counts backed by existing verified files.
