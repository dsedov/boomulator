// GeoJSON Data Processor for Country Borders
// This is a script to process GeoJSON country data into simplified formats for the Boomulator map

const fs = require('fs');
const path = require('path');

// Function to simplify GeoJSON country coordinates to a desired level of detail
function simplifyGeoJSON(geoJSON, simplificationFactor = 0.01) {
  // In a real implementation we would use turf.js or a similar library:
  // return turf.simplify(geoJSON, { tolerance: simplificationFactor, highQuality: true });
  
  // For this demonstration, we'll just use a simulated simplification
  // by taking every Nth point from the original data
  
  const simplified = JSON.parse(JSON.stringify(geoJSON));
  
  simplified.features.forEach(feature => {
    if (feature.geometry.type === 'Polygon') {
      feature.geometry.coordinates = feature.geometry.coordinates.map(ring => {
        return ring.filter((_, i) => i % Math.ceil(1/simplificationFactor) === 0);
      });
    } 
    else if (feature.geometry.type === 'MultiPolygon') {
      feature.geometry.coordinates = feature.geometry.coordinates.map(polygon => {
        return polygon.map(ring => {
          return ring.filter((_, i) => i % Math.ceil(1/simplificationFactor) === 0);
        });
      });
    }
  });
  
  return simplified;
}

// Function to convert GeoJSON to our custom format for countries.js
function convertToCountriesFormat(geoJSON) {
  const countries = [];
  
  geoJSON.features.forEach(feature => {
    const name = feature.properties.NAME || feature.properties.name;
    const region = getRegionForCountry(name);
    
    // Handle different geometry types
    if (feature.geometry.type === 'Polygon') {
      const polygon = feature.geometry.coordinates[0]; // Use outer ring only
      countries.push({
        name,
        region,
        polygon
      });
    } 
    else if (feature.geometry.type === 'MultiPolygon') {
      // For multipolygons, use the largest polygon by area
      const largestPolygon = getLargestPolygon(feature.geometry.coordinates);
      countries.push({
        name,
        region,
        polygon: largestPolygon
      });
    }
  });
  
  return countries;
}

// Helper function to get the largest polygon from multipolygons by point count (as a proxy for area)
function getLargestPolygon(multiPolygon) {
  let largest = multiPolygon[0][0];
  let maxPoints = multiPolygon[0][0].length;
  
  multiPolygon.forEach(polygon => {
    polygon.forEach(ring => {
      if (ring.length > maxPoints) {
        maxPoints = ring.length;
        largest = ring;
      }
    });
  });
  
  return largest;
}

// Helper function to classify countries into regions
function getRegionForCountry(countryName) {
  const regionMap = {
    // North America
    'United States': 'northAmerica',
    'Canada': 'northAmerica',
    'Mexico': 'northAmerica',
    'Greenland': 'northAmerica',
    
    // South America
    'Brazil': 'southAmerica',
    'Argentina': 'southAmerica',
    'Colombia': 'southAmerica',
    'Peru': 'southAmerica',
    'Venezuela': 'southAmerica',
    'Chile': 'southAmerica',
    
    // Europe
    'Russia': 'europe', // Though it spans Europe and Asia
    'Germany': 'europe',
    'United Kingdom': 'europe',
    'France': 'europe',
    'Italy': 'europe',
    'Spain': 'europe',
    'Ukraine': 'europe',
    'Poland': 'europe',
    'Romania': 'europe',
    'Netherlands': 'europe',
    'Belgium': 'europe',
    'Sweden': 'europe',
    'Czech Republic': 'europe',
    'Greece': 'europe',
    'Portugal': 'europe',
    'Hungary': 'europe',
    'Belarus': 'europe',
    'Austria': 'europe',
    'Switzerland': 'europe',
    'Bulgaria': 'europe',
    'Denmark': 'europe',
    'Finland': 'europe',
    'Slovakia': 'europe',
    'Norway': 'europe',
    'Ireland': 'europe',
    'Croatia': 'europe',
    
    // Africa
    'Nigeria': 'africa',
    'Ethiopia': 'africa',
    'Egypt': 'africa',
    'DR Congo': 'africa',
    'Tanzania': 'africa',
    'South Africa': 'africa',
    'Kenya': 'africa',
    'Algeria': 'africa',
    'Sudan': 'africa',
    'Uganda': 'africa',
    'Morocco': 'africa',
    'Mozambique': 'africa',
    'Ghana': 'africa',
    'Angola': 'africa',
    'Ivory Coast': 'africa',
    'Madagascar': 'africa',
    'Cameroon': 'africa',
    'Niger': 'africa',
    'Mali': 'africa',
    'Burkina Faso': 'africa',
    'Malawi': 'africa',
    'Zambia': 'africa',
    'Somalia': 'africa',
    'Chad': 'africa',
    'Zimbabwe': 'africa',
    'Rwanda': 'africa',
    'Tunisia': 'africa',
    'South Sudan': 'africa',
    'Senegal': 'africa',
    'Libya': 'africa',
    
    // Asia
    'China': 'asia',
    'India': 'asia',
    'Indonesia': 'asia',
    'Pakistan': 'asia',
    'Bangladesh': 'asia',
    'Japan': 'asia',
    'Philippines': 'asia',
    'Vietnam': 'asia',
    'Turkey': 'asia',
    'Iran': 'asia',
    'Thailand': 'asia',
    'Myanmar': 'asia',
    'South Korea': 'asia',
    'Iraq': 'asia',
    'Afghanistan': 'asia',
    'Saudi Arabia': 'asia',
    'Malaysia': 'asia',
    'Uzbekistan': 'asia',
    'Nepal': 'asia',
    'Yemen': 'asia',
    'North Korea': 'asia',
    'Taiwan': 'asia',
    'Sri Lanka': 'asia',
    'Kazakhstan': 'asia',
    'Syria': 'asia',
    'Cambodia': 'asia',
    
    // Oceania
    'Australia': 'oceania',
    'Papua New Guinea': 'oceania',
    'New Zealand': 'oceania',
    'Fiji': 'oceania',
    'Solomon Islands': 'oceania',
    'Vanuatu': 'oceania',
    'New Caledonia': 'oceania',
    'French Polynesia': 'oceania'
  };
  
  // Default to the 'other' region if not found in the map
  return regionMap[countryName] || 'other';
}

// Function to generate the countries.js file
function generateCountriesFile(countries) {
  const output = `// Country boundary data for Boomulator world map
// Generated using GeoJSON data from Natural Earth
// Top 50 countries by area with simplified boundaries for pixelated rendering

const countryData = ${JSON.stringify(countries, null, 2)};`;

  return output;
}

// Main processing example - in a real implementation, this would load GeoJSON from disk or an API
function processCountryData(inputGeoJSON, simplificationLevel) {
  // Load and parse GeoJSON data
  // const geoJSON = JSON.parse(fs.readFileSync(inputGeoJSON, 'utf8'));
  
  // Simplify the GeoJSON
  const simplified = simplifyGeoJSON(geoJSON, simplificationLevel);
  
  // Convert to our format
  const countries = convertToCountriesFormat(simplified);
  
  // Generate the output file
  const outputJS = generateCountriesFile(countries);
  
  // Write to disk
  // fs.writeFileSync('countries.js', outputJS);
  
  console.log(`Processed ${countries.length} countries and saved to countries.js`);
}

/*
// Example usage:
const geoJSONPath = 'path/to/countries.geojson';
const simplificationLevel = 0.01; // Higher values = more simplification
processCountryData(geoJSONPath, simplificationLevel);
*/

/*
IMPLEMENTATION STEPS:

1. Download GeoJSON data from Natural Earth Data:
   - Visit https://www.naturalearthdata.com/downloads/110m-cultural-vectors/
   - Download the "Admin 0 – Countries" file

2. Install required dependencies:
   npm install @turf/turf

3. Modify this script to use the downloaded GeoJSON and turf.js library

4. Run the script to generate an updated countries.js file:
   node geojson_processor.js

5. Replace the existing countries.js file in your project with the newly generated one
*/