// DOM elements
let canvas, ctx, lifespanSlider, lifespanValue, replacementSlider, replacementValue;
let childMortalitySlider, childMortalityValue, endYearSlider, endYearValue;
let simulateBtn, loadingIndicator, peakPopulationEl, peakYearEl, endPopulationEl, tooltip;

// Current simulation data
let populationData = [];
let mousePosition = { x: 0, y: 0 };

// Configuration
const startYear = 2020;
const startPopulation = 7.8; // billion
const initialAgeDistribution = {
    // approximate age distribution as of 2020
    '0-9': 0.18,
    '10-19': 0.16,
    '20-29': 0.15,
    '30-39': 0.14,
    '40-49': 0.12,
    '50-59': 0.11,
    '60-69': 0.08,
    '70-79': 0.04,
    '80+': 0.02
};

// Initialize DOM references
function initDomElements() {
    canvas = document.getElementById('populationGraph');
    ctx = canvas.getContext('2d');
    lifespanSlider = document.getElementById('lifespanSlider');
    lifespanValue = document.getElementById('lifespanValue');
    replacementSlider = document.getElementById('replacementSlider');
    replacementValue = document.getElementById('replacementValue');
    childMortalitySlider = document.getElementById('childMortalitySlider');
    childMortalityValue = document.getElementById('childMortalityValue');
    endYearSlider = document.getElementById('endYearSlider');
    endYearValue = document.getElementById('endYearValue');
    simulateBtn = document.getElementById('simulateBtn');
    loadingIndicator = document.getElementById('loadingIndicator');
    peakPopulationEl = document.getElementById('peakPopulation');
    peakYearEl = document.getElementById('peakYear');
    endPopulationEl = document.getElementById('endPopulation');
    tooltip = document.getElementById('tooltip');
    
    // Set initial values for sliders
    lifespanValue.textContent = lifespanSlider.value;
    replacementValue.textContent = replacementSlider.value;
    childMortalityValue.textContent = parseFloat(childMortalitySlider.value).toFixed(1);
    endYearValue.textContent = endYearSlider.value;
}

// Setup canvas for high-resolution
function setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
}

// Event listeners
function setupEventListeners() {
    lifespanSlider.addEventListener('input', function() {
        lifespanValue.textContent = this.value;
    });
    
    replacementSlider.addEventListener('input', function() {
        replacementValue.textContent = this.value;
    });
    
    // Debug the child mortality slider issue
    childMortalitySlider.addEventListener('input', function() {
        console.log("Child mortality slider value:", this.value);
        const formattedValue = parseFloat(this.value).toFixed(1);
        console.log("Formatted value:", formattedValue);
        childMortalityValue.textContent = formattedValue;
    });
    
    endYearSlider.addEventListener('input', function() {
        endYearValue.textContent = this.value;
    });
    
    simulateBtn.addEventListener('click', runSimulation);
    
    canvas.addEventListener('mousemove', function(e) {
        const rect = canvas.getBoundingClientRect();
        mousePosition.x = e.clientX - rect.left;
        mousePosition.y = e.clientY - rect.top;
        
        if (populationData.length > 0) {
            const hoverInfo = getDataPointFromMousePosition(mousePosition);
            if (hoverInfo) {
                tooltip.style.display = 'block';
                tooltip.style.left = `${e.clientX + 10}px`;
                tooltip.style.top = `${e.clientY - 40}px`;
                tooltip.innerHTML = `<strong>Year ${hoverInfo.year}</strong><br>Population: ${hoverInfo.population.toFixed(2)} billion`;
            } else {
                tooltip.style.display = 'none';
            }
        }
    });
    
    canvas.addEventListener('mouseleave', function() {
        tooltip.style.display = 'none';
    });
    
    window.addEventListener('resize', () => {
        if (populationData.length > 0) {
            drawGraph();
        }
    });
}

// Get data point from mouse position
function getDataPointFromMousePosition(position) {
    if (populationData.length === 0) return null;
    
    const rect = canvas.getBoundingClientRect();
    const canvasWidth = rect.width;
    const canvasHeight = rect.height;
    
    // Graph margins
    const margin = {
        top: 30,
        right: 30,
        bottom: 50,
        left: 60
    };
    
    const graphWidth = canvasWidth - margin.left - margin.right;
    const graphHeight = canvasHeight - margin.top - margin.bottom;
    
    const endYear = parseInt(endYearSlider.value);
    const maxPopulation = Math.max(...populationData.map(d => d.population)) * 1.1;
    
    // Convert mouse position to data coordinates
    const xRatio = (position.x - margin.left) / graphWidth;
    const yearRange = endYear - startYear;
    const year = Math.round(startYear + yearRange * xRatio);
    
    // Find the closest data point
    if (xRatio < 0 || xRatio > 1) return null;
    
    const closestDataPoint = populationData.find(d => d.year === year);
    if (closestDataPoint) {
        return closestDataPoint;
    }
    return null;
}

// Population simulation function
function simulatePopulation(lifespan, fertilityRate, childMortalityRate, endYear) {
    // Create age cohorts (0-4, 5-9, ..., 95-99)
    const maxAge = 100;
    const cohortSize = 5;
    const numCohorts = maxAge / cohortSize;
    
    // Convert child mortality from percentage to rate (0-1)
    const infantMortalityRate = childMortalityRate / 100;
    
    // Initialize population with approximate age distribution
    let cohorts = new Array(numCohorts).fill(0);
    
    // Distribute initial population across cohorts
    Object.entries(initialAgeDistribution).forEach(([ageRange, proportion]) => {
        const [start, end] = ageRange.split('-').map(a => a === '+' ? 80 : parseInt(a));
        const startCohort = Math.floor(start / cohortSize);
        const endCohort = end === '+' ? numCohorts - 1 : Math.floor(end / cohortSize);
        
        const cohortsCount = endCohort - startCohort + 1;
        const proportionPerCohort = proportion / cohortsCount;
        
        for (let i = startCohort; i <= endCohort; i++) {
            cohorts[i] = startPopulation * proportionPerCohort;
        }
    });
    
    const results = [];
    const yearStep = 1;
    const simulationYears = endYear - startYear;
    
    // Calculate fertility rate distribution based on age
    // This function creates a fertility curve peaking at age 25-30
    function getFertilityDistribution(fertilityRate) {
        // Age groups of women who can bear children (15-49)
        const fertileCohorts = 7; // 15-19, 20-24, ..., 45-49
        let distribution = new Array(numCohorts).fill(0);
        
        // Create a bell curve peaking at age 25-29
        const fertileStartCohort = 3; // 15-19 age cohort
        const peakFertilityCohort = 5; // 25-29 age cohort
        
        for (let i = 0; i < fertileCohorts; i++) {
            const cohortIndex = fertileStartCohort + i;
            const distanceFromPeak = Math.abs(cohortIndex - peakFertilityCohort);
            const factor = Math.exp(-0.5 * distanceFromPeak);
            distribution[cohortIndex] = factor;
        }
        
        // Normalize to make the sum equal to the total fertility rate
        const sum = distribution.reduce((a, b) => a + b, 0);
        distribution = distribution.map(v => (v / sum) * fertilityRate);
        
        return distribution;
    }
    
    const fertilityDistribution = getFertilityDistribution(fertilityRate);
    
    // Calculate survival rates based on lifespan and child mortality
    function getSurvivalRates(lifespan, infantMortalityRate) {
        const survivalRates = new Array(numCohorts).fill(0);
        
        for (let i = 0; i < numCohorts; i++) {
            const ageMiddle = i * cohortSize + cohortSize / 2;
            
            // Special handling for infant mortality (first cohort)
            if (i === 0) {
                // Higher mortality for infants (0-4)
                survivalRates[i] = 0.995 - infantMortalityRate;
            } 
            // Special handling for child mortality (second cohort)
            else if (i === 1) {
                // Lower but still significant mortality for young children (5-9)
                survivalRates[i] = 0.998 - (infantMortalityRate * 0.3);
            }
            // Normal mortality pattern for rest of the population
            else if (ageMiddle < lifespan * 0.8) {
                // Higher survival until around the lifespan, then declines rapidly
                survivalRates[i] = 0.995 - (ageMiddle / (lifespan * 2.5));
            } else {
                // Gompertz-Makeham law of mortality approximation for older ages
                const agingFactor = Math.exp(0.08 * (ageMiddle - lifespan * 0.8));
                survivalRates[i] = Math.max(0.6 - (ageMiddle / lifespan) * 0.2, 0.1) / agingFactor;
            }
            
            // Ensure survival rates are within valid range
            survivalRates[i] = Math.min(Math.max(survivalRates[i], 0), 0.999);
        }
        
        return survivalRates;
    }
    
    const survivalRates = getSurvivalRates(lifespan, infantMortalityRate);
    
    // Calculate the effective replacement rate accounting for child mortality
    const effectiveReplacementRate = fertilityRate * (1 - infantMortalityRate);
    
    // Run simulation year by year
    for (let year = 0; year <= simulationYears; year += yearStep) {
        const currentYear = startYear + year;
        const totalPopulation = cohorts.reduce((a, b) => a + b, 0);
        
        results.push({
            year: currentYear,
            population: totalPopulation,
            effectiveReplacementRate: effectiveReplacementRate
        });
        
        // Calculate births
        let births = 0;
        for (let i = 0; i < numCohorts; i++) {
            // Only women in fertile age ranges bear children (assume 50% of population is female)
            const femalePop = cohorts[i] * 0.5;
            births += femalePop * fertilityDistribution[i];
        }
        
        // Age the population (backwards to avoid overwriting)
        const newCohorts = new Array(numCohorts).fill(0);
        newCohorts[0] = births; // Add new births
        
        for (let i = 0; i < numCohorts - 1; i++) {
            newCohorts[i + 1] = cohorts[i] * survivalRates[i];
        }
        
        // Last cohort may include some survivors from the previous last cohort
        newCohorts[numCohorts - 1] += cohorts[numCohorts - 1] * survivalRates[numCohorts - 1];
        
        cohorts = newCohorts;
    }
    
    return results;
}

// Main simulation function
function runSimulation() {
    loadingIndicator.style.display = 'flex';
    
    // Get values from sliders
    const lifespan = parseInt(lifespanSlider.value);
    const fertilityRate = parseFloat(replacementSlider.value);
    const childMortality = parseFloat(childMortalitySlider.value);
    const endYear = parseInt(endYearSlider.value);
    
    // Simulate with a slight delay to allow UI to update
    setTimeout(() => {
        populationData = simulatePopulation(lifespan, fertilityRate, childMortality, endYear);
        drawGraph();
        updateStatistics();
        loadingIndicator.style.display = 'none';
    }, 50);
}

// Update statistics display
function updateStatistics() {
    // Find peak population
    const peak = populationData.reduce((max, current) => 
        current.population > max.population ? current : max, 
        { population: 0 });
    
    // End population
    const end = populationData[populationData.length - 1];
    
    // Get effective replacement rate
    const effectiveReplacement = end.effectiveReplacementRate;
    
    // Get reference to the effective replacement element
    const effectiveReplacementEl = document.getElementById('effectiveReplacement');
    
    // Update statistics
    peakPopulationEl.textContent = `${peak.population.toFixed(2)} billion`;
    peakYearEl.textContent = peak.year;
    endPopulationEl.textContent = `${end.population.toFixed(2)} billion`;
    effectiveReplacementEl.textContent = effectiveReplacement.toFixed(2);
    
    // Color code the effective replacement based on whether it's above or below 2.1
    // which is the typically accepted replacement rate for population stability
    if (effectiveReplacement < 2.1) {
        effectiveReplacementEl.style.color = '#e74c3c'; // Red for below replacement
    } else {
        effectiveReplacementEl.style.color = '#ffffff'; // White for at or above replacement
    }
}

// Draw the graph
function drawGraph() {
    if (!populationData.length) return;
    
    setupCanvas();
    
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    // Clear the canvas
    ctx.clearRect(0, 0, width, height);
    
    // Set margins
    const margin = {
        top: 30,
        right: 30,
        bottom: 50,
        left: 60
    };
    
    const graphWidth = width - margin.left - margin.right;
    const graphHeight = height - margin.top - margin.bottom;
    
    // Find max population for scaling
    const maxPopulation = Math.max(...populationData.map(d => d.population)) * 1.1;
    const endYear = parseInt(endYearSlider.value);
    
    // Round maxPopulation to nearest 100 million for cleaner axis
    const roundedMaxPop = Math.ceil(maxPopulation / 1) * 1;
    
    // Draw Y-axis
    ctx.beginPath();
    ctx.strokeStyle = '#ccc';
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, height - margin.bottom);
    ctx.stroke();
    
    // Draw X-axis
    ctx.beginPath();
    ctx.moveTo(margin.left, height - margin.bottom);
    ctx.lineTo(width - margin.right, height - margin.bottom);
    ctx.stroke();
    
    // Y-axis ticks and labels
    const yTickCount = 10;
    const yTickStep = roundedMaxPop / yTickCount;
    
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = '12px Arial';
    ctx.fillStyle = '#666';
    
    for (let i = 0; i <= yTickCount; i++) {
        const yValue = i * yTickStep;
        const yPos = height - margin.bottom - (yValue / roundedMaxPop) * graphHeight;
        
        // Draw tick
        ctx.beginPath();
        ctx.moveTo(margin.left - 5, yPos);
        ctx.lineTo(margin.left, yPos);
        ctx.stroke();
        
        // Draw grid line
        ctx.beginPath();
        ctx.strokeStyle = '#eee';
        ctx.moveTo(margin.left, yPos);
        ctx.lineTo(width - margin.right, yPos);
        ctx.stroke();
        
        // Draw label
        ctx.fillText(`${yValue.toFixed(1)}B`, margin.left - 10, yPos);
    }
    
    // X-axis ticks and labels
    const xTickCount = Math.min(10, (endYear - startYear) / 10);
    const xTickStep = (endYear - startYear) / xTickCount;
    
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    for (let i = 0; i <= xTickCount; i++) {
        const year = startYear + i * xTickStep;
        const xPos = margin.left + (i * xTickStep / (endYear - startYear)) * graphWidth;
        
        // Draw tick
        ctx.beginPath();
        ctx.strokeStyle = '#ccc';
        ctx.moveTo(xPos, height - margin.bottom);
        ctx.lineTo(xPos, height - margin.bottom + 5);
        ctx.stroke();
        
        // Draw grid line
        ctx.beginPath();
        ctx.strokeStyle = '#eee';
        ctx.moveTo(xPos, margin.top);
        ctx.lineTo(xPos, height - margin.bottom);
        ctx.stroke();
        
        // Draw label
        ctx.fillText(year.toString(), xPos, height - margin.bottom + 10);
    }
    
    // Draw axis labels
    ctx.font = '14px Arial';
    ctx.fillStyle = '#444';
    
    // X-axis label
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Year', width / 2, height - 15);
    
    // Y-axis label
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('Population (Billions)', 0, 0);
    ctx.restore();
    
    // Draw the data line
    ctx.beginPath();
    ctx.strokeStyle = '#3a86ff';
    ctx.lineWidth = 3;
    
    populationData.forEach((d, i) => {
        const x = margin.left + ((d.year - startYear) / (endYear - startYear)) * graphWidth;
        const y = height - margin.bottom - (d.population / roundedMaxPop) * graphHeight;
        
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    
    ctx.stroke();
    
    // Add area under curve with gradient
    const gradientFill = ctx.createLinearGradient(0, margin.top, 0, height - margin.bottom);
    gradientFill.addColorStop(0, 'rgba(58, 134, 255, 0.8)');
    gradientFill.addColorStop(1, 'rgba(58, 134, 255, 0.1)');
    
    ctx.beginPath();
    ctx.fillStyle = gradientFill;
    
    // First point
    let firstPoint = populationData[0];
    let x = margin.left + ((firstPoint.year - startYear) / (endYear - startYear)) * graphWidth;
    let y = height - margin.bottom - (firstPoint.population / roundedMaxPop) * graphHeight;
    ctx.moveTo(x, y);
    
    // Connect all points
    populationData.forEach((d) => {
        x = margin.left + ((d.year - startYear) / (endYear - startYear)) * graphWidth;
        y = height - margin.bottom - (d.population / roundedMaxPop) * graphHeight;
        ctx.lineTo(x, y);
    });
    
    // Complete the path
    ctx.lineTo(x, height - margin.bottom);
    ctx.lineTo(margin.left, height - margin.bottom);
    ctx.closePath();
    ctx.fill();
    
    // Add data points
    const stepSize = Math.max(1, Math.floor(populationData.length / 20));
    for (let i = 0; i < populationData.length; i += stepSize) {
        const d = populationData[i];
        const x = margin.left + ((d.year - startYear) / (endYear - startYear)) * graphWidth;
        const y = height - margin.bottom - (d.population / roundedMaxPop) * graphHeight;
        
        ctx.beginPath();
        ctx.fillStyle = '#fff';
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.strokeStyle = '#3a86ff';
        ctx.lineWidth = 2;
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.stroke();
    }
}

// Initialize application
function init() {
    initDomElements();
    setupEventListeners();
    runSimulation();
}

// Run initialization when document is loaded
window.addEventListener('load', init);