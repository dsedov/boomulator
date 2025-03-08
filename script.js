// DOM elements
let canvas, ctx, lifespanSlider, lifespanValue, replacementSlider, replacementValue;
let childMortalitySlider, childMortalityValue, migrationSlider, migrationValue;
let startPopulationSlider, startPopulationValue, endYearSlider, endYearValue;
let simulateBtn, loadingIndicator, peakPopulationEl, peakYearEl, endPopulationEl, tooltip;

// For debouncing slider updates
let updateTimerId = null;

// Current simulation data
let populationData = [];
let mousePosition = { x: 0, y: 0 };

// Configuration
const startYear = 2020;
let startPopulation; // Will be set from slider value in millions and converted to billions
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
    migrationSlider = document.getElementById('migrationSlider');
    migrationValue = document.getElementById('migrationValue');
    startPopulationSlider = document.getElementById('startPopulationSlider');
    startPopulationValue = document.getElementById('startPopulationValue');
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
    migrationValue.textContent = parseFloat(migrationSlider.value).toFixed(1);
    startPopulationValue.textContent = startPopulationSlider.value;
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

// Debounce function to prevent too many simulation runs
function debounceUpdate(callback, delay = 200) {
    if (updateTimerId) {
        clearTimeout(updateTimerId);
    }
    updateTimerId = setTimeout(callback, delay);
}

// Event listeners
function setupEventListeners() {
    const sliderInputHandler = function() {
        // Update the displayed value
        switch(this.id) {
            case 'lifespanSlider':
                lifespanValue.textContent = this.value;
                break;
            case 'replacementSlider':
                replacementValue.textContent = this.value;
                break;
            case 'childMortalitySlider':
                childMortalityValue.textContent = parseFloat(this.value).toFixed(1);
                break;
            case 'migrationSlider':
                migrationValue.textContent = parseFloat(this.value).toFixed(1);
                break;
            case 'startPopulationSlider':
                startPopulationValue.textContent = parseFloat(this.value).toFixed(0);
                break;
            case 'endYearSlider':
                endYearValue.textContent = this.value;
                break;
        }
        
        // Debounce the simulation update
        debounceUpdate(runSimulation);
    };

    // Add input event listeners to all sliders
    lifespanSlider.addEventListener('input', sliderInputHandler);
    replacementSlider.addEventListener('input', sliderInputHandler);
    childMortalitySlider.addEventListener('input', sliderInputHandler);
    migrationSlider.addEventListener('input', sliderInputHandler);
    startPopulationSlider.addEventListener('input', sliderInputHandler);
    endYearSlider.addEventListener('input', sliderInputHandler);
    
    // Keep the button for immediate updates if needed
    simulateBtn.addEventListener('click', runSimulation);
    
    canvas.addEventListener('mousemove', function(e) {
        const rect = canvas.getBoundingClientRect();
        mousePosition.x = e.clientX - rect.left;
        mousePosition.y = e.clientY - rect.top;
        
        if (populationData.length > 0) {
            const hoverInfo = getDataPointFromMousePosition(mousePosition);
            if (hoverInfo) {
                tooltip.style.display = 'block';
                
                // Position tooltip relative to the mouse cursor
                // Using position:fixed in CSS, so we just need viewport coordinates
                tooltip.style.left = `${e.clientX + 15}px`;
                tooltip.style.top = `${e.clientY - 40}px`;
                
                // Format population based on scale
                let popDisplay;
                if (startPopulation < 0.1) {  // Less than 100 million
                    popDisplay = `${(hoverInfo.population * 1000).toFixed(1)} million`;
                } else {
                    popDisplay = `${hoverInfo.population.toFixed(2)} billion`;
                }
                
                tooltip.innerHTML = `<strong>Year ${hoverInfo.year}</strong><br>Population: ${popDisplay}`;
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
function simulatePopulation(lifespan, fertilityRate, childMortalityRate, migrationRate, endYear) {
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
        
        // Baseline survival rates for modern developed countries
        // These values are calibrated to produce stability at a TFR of 2.1
        const baselineSurvival = {
            infant: 0.996,  // 0-4 age group
            child: 0.998,   // 5-9 age group
            youth: 0.999,   // 10-14 through 30s
            adult: 0.998,   // 40s through early 60s
            senior: 0.990,  // Late 60s
            elderly: 0.980  // 70s
            // Older ages are calculated with Gompertz-Makeham
        };
        
        for (let i = 0; i < numCohorts; i++) {
            const ageMiddle = i * cohortSize + cohortSize / 2;
            
            // Special handling for infant mortality (first cohort 0-4)
            if (i === 0) {
                // Apply infant mortality parameter directly
                survivalRates[i] = baselineSurvival.infant - infantMortalityRate;
            } 
            // Special handling for child mortality (second cohort 5-9)
            else if (i === 1) {
                // Apply a reduced effect of infant mortality to young children
                survivalRates[i] = baselineSurvival.child - (infantMortalityRate * 0.3);
            }
            // Youth and young adults (10-39)
            else if (i >= 2 && i < 8) {
                survivalRates[i] = baselineSurvival.youth;
            }
            // Middle-aged adults (40-64)
            else if (i >= 8 && i < 13) {
                survivalRates[i] = baselineSurvival.adult;
            }
            // Seniors (65-69)
            else if (i === 13) {
                survivalRates[i] = baselineSurvival.senior;
            }
            // Elderly (70-79)
            else if (i >= 14 && i < 16) {
                survivalRates[i] = baselineSurvival.elderly;
            }
            // Older adults using Gompertz-Makeham mortality model
            else {
                // Calculate how far the age is past 80% of the typical lifespan
                const lifeExpectancyFactor = ageMiddle / lifespan;
                
                // Create a steeper decline as people approach and exceed the typical lifespan
                if (ageMiddle < lifespan * 0.9) {
                    // Before reaching 90% of lifespan
                    survivalRates[i] = 0.95 - (lifeExpectancyFactor - 0.6) * 0.6;
                } else {
                    // After reaching 90% of lifespan, mortality increases more rapidly
                    const agingFactor = Math.exp(0.15 * (ageMiddle - lifespan * 0.9));
                    survivalRates[i] = 0.7 / agingFactor;
                }
            }
            
            // Apply lifespan adjustment - as lifespan increases, survival rates improve
            // but with diminishing returns past 80 years
            if (lifespan > 70 && i > 10) {
                const lifeExpectancyBonus = Math.min((lifespan - 70) / 30, 1) * 0.05;
                survivalRates[i] += lifeExpectancyBonus * (1 - (i / numCohorts));
            }
            
            // Ensure survival rates are within valid range
            survivalRates[i] = Math.min(Math.max(survivalRates[i], 0), 0.999);
        }
        
        return survivalRates;
    }
    
    const survivalRates = getSurvivalRates(lifespan, infantMortalityRate);
    
    // Calculate the effective replacement rate accounting for child mortality
    const effectiveReplacementRate = fertilityRate * (1 - infantMortalityRate);
    
    // Debug the rates
    console.log("Fertility Rate:", fertilityRate);
    console.log("Fertility Distribution:", fertilityDistribution);
    console.log("Survival Rates:", survivalRates);
    console.log("Effective Replacement Rate:", effectiveReplacementRate);
    
    // Run simulation year by year
    for (let year = 0; year <= simulationYears; year += yearStep) {
        const currentYear = startYear + year;
        const totalPopulation = cohorts.reduce((a, b) => a + b, 0);
        
        // Calculate current year fertility rate (could be modified for time-dependent changes)
        const currentFertilityRate = fertilityRate;
        
        results.push({
            year: currentYear,
            population: totalPopulation,
            effectiveReplacementRate: effectiveReplacementRate
        });
        
        // Calculate births
        let births = 0;
        let totalFertileWomen = 0;
        
        for (let i = 0; i < numCohorts; i++) {
            // Only women in fertile age ranges bear children (assume 50% of population is female)
            const femalePop = cohorts[i] * 0.5;
            
            // Track total number of women in fertile cohorts for debugging
            if (fertilityDistribution[i] > 0) {
                totalFertileWomen += femalePop;
            }
            
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
        
        // Apply migration effects if migration rate is not zero
        if (migrationRate !== 0) {
            // Convert migration rate from per 1000 to a decimal
            const migrationFactor = migrationRate / 1000;
            
            // Calculate absolute number of migrants
            const netMigrants = totalPopulation * migrationFactor;
            
            // Distribute migrants across age cohorts, focusing on working-age population
            // Most migrants are working age (20-50)
            const migrantDistribution = {
                children: 0.15,      // 0-19
                youngAdults: 0.35,   // 20-34
                middleAdults: 0.30,  // 35-49
                olderAdults: 0.15,   // 50-64
                elderly: 0.05        // 65+
            };
            
            // Apply migration to each cohort
            for (let i = 0; i < numCohorts; i++) {
                const ageMiddle = i * cohortSize + cohortSize / 2;
                let migrationShare = 0;
                
                // Assign migration share based on age group
                if (ageMiddle < 20) {
                    migrationShare = migrantDistribution.children / 4; // 4 cohorts (0-19)
                } else if (ageMiddle < 35) {
                    migrationShare = migrantDistribution.youngAdults / 3; // 3 cohorts (20-34)
                } else if (ageMiddle < 50) {
                    migrationShare = migrantDistribution.middleAdults / 3; // 3 cohorts (35-49)
                } else if (ageMiddle < 65) {
                    migrationShare = migrantDistribution.olderAdults / 3; // 3 cohorts (50-64)
                } else {
                    migrationShare = migrantDistribution.elderly / 7; // 7 cohorts (65+)
                }
                
                // Apply migration to this cohort
                newCohorts[i] += netMigrants * migrationShare;
                
                // Ensure population doesn't go below zero in any cohort
                if (newCohorts[i] < 0) {
                    newCohorts[i] = 0;
                }
            }
        }
        
        // Debug info for every 10 years
        if (year % 10 === 0) {
            console.log(`Year ${currentYear}:`, {
                totalPopulation,
                births,
                totalFertileWomen,
                birthRate: totalFertileWomen > 0 ? births / totalFertileWomen : 0,
                migrationEffect: migrationRate !== 0 ? totalPopulation * (migrationRate / 1000) : 0
            });
        }
        
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
    const migrationRate = parseFloat(migrationSlider.value);
    const initialPopulation = parseFloat(startPopulationSlider.value) / 1000; // Convert millions to billions
    const endYear = parseInt(endYearSlider.value);
    
    // Set the global start population value
    startPopulation = initialPopulation;
    
    // Update the UI to indicate simulation is running
    simulateBtn.textContent = "Updating...";
    simulateBtn.disabled = true;
    
    // Simulate with a slight delay to allow UI to update
    setTimeout(() => {
        populationData = simulatePopulation(lifespan, fertilityRate, childMortality, migrationRate, endYear);
        drawGraph();
        updateStatistics();
        loadingIndicator.style.display = 'none';
        
        // Reset button
        simulateBtn.textContent = "Run Simulation";
        simulateBtn.disabled = false;
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
    
    // Get references to statistics elements
    const effectiveReplacementEl = document.getElementById('effectiveReplacement');
    const migrationEffectEl = document.getElementById('migrationEffect');
    
    // Get migration rate value
    const migrationRate = parseFloat(migrationSlider.value);
    
    // Calculate net migration effect (annually per 1000 people)
    const migrationEffect = migrationRate;
    
    // Update statistics - format based on scale
    let peakPopText, endPopText;
    
    if (startPopulation < 0.1) {  // Less than 100 million
        peakPopText = `${(peak.population * 1000).toFixed(1)} million`;
        endPopText = `${(end.population * 1000).toFixed(1)} million`;
    } else {
        peakPopText = `${peak.population.toFixed(2)} billion`;
        endPopText = `${end.population.toFixed(2)} billion`;
    }
    
    // Update statistics
    peakPopulationEl.textContent = peakPopText;
    peakYearEl.textContent = peak.year;
    endPopulationEl.textContent = endPopText;
    effectiveReplacementEl.textContent = effectiveReplacement.toFixed(2);
    
    // Format migration effect with sign
    if (migrationRate > 0) {
        migrationEffectEl.textContent = `+${migrationRate.toFixed(1)}%`;
    } else if (migrationRate < 0) {
        migrationEffectEl.textContent = `${migrationRate.toFixed(1)}%`;
    } else {
        migrationEffectEl.textContent = `0.0%`;
    }
    
    // Color code the effective replacement based on whether it's above or below 2.1
    // which is the typically accepted replacement rate for population stability
    const stabilityThreshold = 2.1;
    
    // Classify and color-code the population trend using terminal colors
    if (effectiveReplacement < stabilityThreshold * 0.85) {
        // Severe decline - terminal red
        effectiveReplacementEl.style.color = '#e14833';
    } else if (effectiveReplacement < stabilityThreshold) {
        // Mild decline - terminal yellow
        effectiveReplacementEl.style.color = '#eaffca';
    } else if (effectiveReplacement < stabilityThreshold * 1.15) {
        // Stability - terminal cyan
        effectiveReplacementEl.style.color = '#7dfdf9';
    } else {
        // Growth - terminal green
        effectiveReplacementEl.style.color = '#5ae7b3';
    }
    
    // Color code the migration effect using terminal colors
    if (migrationRate > 0) {
        migrationEffectEl.style.color = '#5ae7b3'; // Terminal green for positive migration
    } else if (migrationRate < 0) {
        migrationEffectEl.style.color = '#e14833'; // Terminal red for negative migration
    } else {
        migrationEffectEl.style.color = '#7dfdf9'; // Terminal cyan for no migration
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
    
    // Define pixel size for grid alignment
    const pixelSize = 2;
    
    // Draw Y-axis with blue color using pixelated style
    ctx.fillStyle = '#2183c8';
    for (let y = margin.top; y <= height - margin.bottom; y += pixelSize) {
        // Align to pixel grid
        const alignedY = Math.floor(y / pixelSize) * pixelSize;
        ctx.fillRect(margin.left - pixelSize/2, alignedY, pixelSize, pixelSize);
    }
    
    // Draw X-axis with blue color using pixelated style
    for (let x = margin.left; x <= width - margin.right; x += pixelSize) {
        // Align to pixel grid
        const alignedX = Math.floor(x / pixelSize) * pixelSize;
        ctx.fillRect(alignedX, height - margin.bottom - pixelSize/2, pixelSize, pixelSize);
    }
    
    // Y-axis ticks and labels
    const yTickCount = 10;
    const yTickStep = roundedMaxPop / yTickCount;
    
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = '14px "Tiny5", monospace';
    ctx.fillStyle = '#7dfdf9';
    ctx.textTransform = 'uppercase';
    
    for (let i = 0; i <= yTickCount; i++) {
        const yValue = i * yTickStep;
        const yPos = height - margin.bottom - (yValue / roundedMaxPop) * graphHeight;
        
        // Draw pixelated tick
        const alignedYPos = Math.floor(yPos / pixelSize) * pixelSize;
        ctx.fillStyle = '#2183c8';
        for (let x = margin.left - pixelSize*3; x < margin.left; x += pixelSize) {
            ctx.fillRect(x, alignedYPos - pixelSize/2, pixelSize, pixelSize);
        }
        
        // No grid lines
        
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
        
        // Draw pixelated tick
        const alignedXPos = Math.floor(xPos / pixelSize) * pixelSize;
        ctx.fillStyle = '#2183c8';
        for (let y = height - margin.bottom; y < height - margin.bottom + pixelSize*3; y += pixelSize) {
            ctx.fillRect(alignedXPos - pixelSize/2, y, pixelSize, pixelSize);
        }
        
        // No grid lines
        
        // Draw label
        ctx.fillText(year.toString(), xPos, height - margin.bottom + 10);
    }
    
    // No axis labels for cleaner console look
    
    // Create a pixelated line with 2px squares using the appropriate color
    // Use yellow color by default
    ctx.strokeStyle = '#eaffca'; // --yellow-color
    ctx.fillStyle = '#eaffca'; // --yellow-color
    ctx.lineWidth = 0;
    
    // Draw pixel by pixel for a true pixelated look - more points for 2px size
    const pixelStep = Math.max(1, Math.floor(populationData.length / 120));
    let previousPixels = new Set(); // Track which pixels we've already drawn
    
    for (let i = 0; i < populationData.length; i += pixelStep) {
        const d = populationData[i];
        // Calculate position and snap to pixelSize grid
        const x = Math.floor((margin.left + ((d.year - startYear) / (endYear - startYear)) * graphWidth) / pixelSize) * pixelSize;
        const y = Math.floor((height - margin.bottom - (d.population / roundedMaxPop) * graphHeight) / pixelSize) * pixelSize;
        
        // Set color based on population value
        if (d.population <= 0.01) {
            ctx.fillStyle = '#e14833'; // Use red color when population hits 0.01 billion or below
        } else {
            ctx.fillStyle = '#eaffca'; // Default yellow color for positive population
        }
        
        // Draw the pixel
        const pixelKey = `${x},${y}`;
        if (!previousPixels.has(pixelKey)) {
            ctx.fillRect(x, y, pixelSize, pixelSize);
            previousPixels.add(pixelKey);
        }
        
        // Fill in gaps between points to create a continuous line
        if (i > 0) {
            const prev = populationData[i - pixelStep];
            const prevX = Math.floor((margin.left + ((prev.year - startYear) / (endYear - startYear)) * graphWidth) / pixelSize) * pixelSize;
            const prevY = Math.floor((height - margin.bottom - (prev.population / roundedMaxPop) * graphHeight) / pixelSize) * pixelSize;
            
            // Create a line of pixels between the points
            if (prevX !== x || prevY !== y) {
                // Determine the number of steps needed based on the distance
                const dx = x - prevX;
                const dy = y - prevY;
                const steps = Math.max(Math.abs(dx), Math.abs(dy)) / pixelSize;
                
                // Draw each pixel along the line
                for (let j = 1; j < steps; j++) {
                    const stepX = Math.floor(prevX + dx * (j / steps));
                    const stepY = Math.floor(prevY + dy * (j / steps));
                    // Snap to pixel grid
                    const pixX = Math.floor(stepX / pixelSize) * pixelSize;
                    const pixY = Math.floor(stepY / pixelSize) * pixelSize;
                    
                    // Calculate the interpolated population value
                    const interpolatedPopulation = prev.population + (d.population - prev.population) * (j / steps);
                    
                    // Set color based on interpolated population value
                    if (interpolatedPopulation <= 0.01) {
                        ctx.fillStyle = '#e14833'; // Use red color when population hits 0.01 billion or below
                    } else {
                        ctx.fillStyle = '#eaffca'; // Default yellow color for positive population
                    }
                    
                    const pixelKey = `${pixX},${pixY}`;
                    if (!previousPixels.has(pixelKey)) {
                        ctx.fillRect(pixX, pixY, pixelSize, pixelSize);
                        previousPixels.add(pixelKey);
                    }
                }
            }
        }
    }
    
    // No area under curve or gradient - cleaner pixelated look
    
    // Only add a few key data points to avoid cluttering the pixelated line
    const stepSize = Math.max(1, Math.floor(populationData.length / 12));
    for (let i = 0; i < populationData.length; i += stepSize) {
        const d = populationData[i];
        // Use math floor to create pixelated alignment
        const x = Math.floor((margin.left + ((d.year - startYear) / (endYear - startYear)) * graphWidth) / pixelSize) * pixelSize;
        const y = Math.floor((height - margin.bottom - (d.population / roundedMaxPop) * graphHeight) / pixelSize) * pixelSize;
        
        // Draw pixelated points that are larger than the line pixels
        const pointSize = pixelSize * 3;
        ctx.fillStyle = '#131e21';
        ctx.fillRect(x - pointSize/2, y - pointSize/2, pointSize, pointSize);
        
        // Set stroke color based on population value
        if (d.population <= 0.01) {
            ctx.strokeStyle = '#e14833'; // Use red color when population hits 0.01 billion or below
        } else {
            ctx.strokeStyle = '#eaffca'; // Default yellow color for positive population
        }
        
        ctx.lineWidth = pixelSize/2;
        ctx.strokeRect(x - pointSize/2, y - pointSize/2, pointSize, pointSize);
    }
}

// Initialize pixelation filter
function initPixelationFilter() {
    const filterCanvas = document.getElementById('pixelation-filter');
    const filterCtx = filterCanvas.getContext('2d');
    const pixelSize = 2; // Size of each "pixel" in the filter
    
    function setupFilterCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const rect = filterCanvas.getBoundingClientRect();
        filterCanvas.width = rect.width * dpr;
        filterCanvas.height = rect.height * dpr;
        filterCtx.scale(dpr, dpr);
        filterCanvas.style.width = `${rect.width}px`;
        filterCanvas.style.height = `${rect.height}px`;
    }
    
    function drawPixelationGrid() {
        setupFilterCanvas();
        const width = filterCanvas.width;
        const height = filterCanvas.height;
        
        filterCtx.clearRect(0, 0, width, height);
        
        // Draw semi-transparent pixel grid
        filterCtx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
        filterCtx.lineWidth = 1;
        
        // Draw vertical lines
        for (let x = 0; x < width; x += pixelSize) {
            filterCtx.beginPath();
            filterCtx.moveTo(x, 0);
            filterCtx.lineTo(x, height);
            filterCtx.stroke();
        }
        
        // Draw horizontal lines
        for (let y = 0; y < height; y += pixelSize) {
            filterCtx.beginPath();
            filterCtx.moveTo(0, y);
            filterCtx.lineTo(width, y);
            filterCtx.stroke();
        }
        
        // Add noise to some pixels for CRT effect
        filterCtx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        for (let x = 0; x < width; x += pixelSize * 2) {
            for (let y = 0; y < height; y += pixelSize * 2) {
                if (Math.random() > 0.9) {
                    filterCtx.fillRect(x, y, pixelSize, pixelSize);
                }
            }
        }
    }
    
    // Initial draw
    drawPixelationGrid();
    
    // Redraw on window resize
    window.addEventListener('resize', drawPixelationGrid);
}

// Initialize application
function init() {
    initDomElements();
    setupEventListeners();
    runSimulation();
    initPixelationFilter();
}

// Run initialization when document is loaded
window.addEventListener('load', init);