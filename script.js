// DOM elements
let canvas, ctx, worldMapCanvas, worldMapCtx, lifespanSlider, lifespanValue, replacementSlider, replacementValue;
let childMortalitySlider, childMortalityValue, migrationSlider, migrationValue;
let startPopulationSlider, startPopulationValue, endYearSlider, endYearValue;
let simulateBtn, loadingIndicator, peakPopulationEl, peakYearEl, endPopulationEl, tooltip, countryTooltip;
let countries = []; // Will store country data for hover detection

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
    worldMapCanvas = document.getElementById('worldMapCanvas');
    worldMapCtx = worldMapCanvas.getContext('2d');
    
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
    countryTooltip = document.getElementById('countryTooltip');
    
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
    
    // Setup population graph canvas
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    
    // Setup world map canvas
    const mapRect = worldMapCanvas.getBoundingClientRect();
    worldMapCanvas.width = mapRect.width * dpr;
    worldMapCanvas.height = mapRect.height * dpr;
    worldMapCtx.scale(dpr, dpr);
    worldMapCanvas.style.width = `${mapRect.width}px`;
    worldMapCanvas.style.height = `${mapRect.height}px`;
}

// Debounce function to prevent too many simulation runs
function debounceUpdate(callback, delay = 200) {
    if (updateTimerId) {
        clearTimeout(updateTimerId);
    }
    updateTimerId = setTimeout(() => {
        callback();
        updateURLWithParameters();
    }, delay);
}

function updateURLWithParameters() {
    const params = new URLSearchParams();
    params.set('lifespan', lifespanSlider.value);
    params.set('fertility', replacementSlider.value);
    params.set('childMortality', childMortalitySlider.value);
    params.set('migration', migrationSlider.value);
    params.set('startPopulation', startPopulationSlider.value);
    params.set('endYear', endYearSlider.value);
    
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    
    // Force a redraw of the globe to update flow lines based on new migration value
    if (globeCtx) {
        drawGlobe();
    }
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
    simulateBtn.addEventListener('click', () => {
        runSimulation();
        updateURLWithParameters();
    });
    
    // Share button functionality
    const shareBtn = document.getElementById('shareBtn');
    shareBtn.addEventListener('click', async () => {
        updateURLWithParameters();
        try {
            await navigator.clipboard.writeText(window.location.href);
            const originalText = shareBtn.textContent;
            shareBtn.textContent = "URL Copied!";
            setTimeout(() => {
                shareBtn.textContent = originalText;
            }, 2000);
        } catch (err) {
            console.error('Failed to copy: ', err);
            alert('Could not copy URL. Please copy it manually from your browser address bar.');
        }
    });
    
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
    
    // Add debouncing for resize to avoid excessive redraws
    let resizeTimeout;
    const resizeHandler = () => {
        // Reset canvas dimensions and redraw
        setupCanvas();
        
        // Draw graph if we have data
        if (populationData.length > 0) {
            drawGraph();
        }
        
        // Always redraw the map
        drawWorldMap();
    };
    
    // Handle resize events
    window.addEventListener('resize', () => {
        // Clear previous timeout
        if (resizeTimeout) {
            clearTimeout(resizeTimeout);
        }
        
        // Redraw immediately during resize
        resizeHandler();
        
        // Set a timeout to handle the final state after resize ends
        resizeTimeout = setTimeout(() => {
            resizeHandler();
        }, 100);
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
    
    // Convert child mortality from deaths per 1000 to rate (0-1)
    const infantMortalityRate = childMortalityRate / 1000;
    
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
    
    // Calculate the total initial population to ensure we start with the correct value
    const initialTotalPopulation = cohorts.reduce((a, b) => a + b, 0);
    console.log("Initial population before pre-simulation:", initialTotalPopulation, "billion");
    
    // Pre-simulate for 20 years to stabilize the model dynamics
    // This removes the initial transient behavior
    const preSimulationYears = 20;
    const preSimulationResults = runSimulationCycle(
        cohorts.slice(), // Clone the cohorts array
        preSimulationYears,
        startYear - preSimulationYears, // Start earlier
        fertilityRate,
        infantMortalityRate,
        migrationRate,
        lifespan,
        numCohorts,
        cohortSize,
        false // Don't collect results during pre-simulation
    );
    
    // Use the last state from pre-simulation as the starting point
    let finalCohorts = preSimulationResults.finalCohorts;
    
    // Calculate post-presimulation total to see if we need to adjust
    const postPresimTotalPop = finalCohorts.reduce((a, b) => a + b, 0);
    console.log("Population after pre-simulation:", postPresimTotalPop, "billion");
    
    // If there's a significant difference, scale to maintain the desired population
    if (Math.abs(postPresimTotalPop - startPopulation) > 0.01) {
        const scaleFactor = startPopulation / postPresimTotalPop;
        console.log(`Adjusting population with scale factor: ${scaleFactor}`);
        finalCohorts = finalCohorts.map(cohort => cohort * scaleFactor);
        
        // Verify the correction
        const correctedTotalPop = finalCohorts.reduce((a, b) => a + b, 0);
        console.log("Corrected population:", correctedTotalPop, "billion");
    }
    
    // Run the actual simulation using our extracted simulation function with corrected cohorts
    const results = runSimulationCycle(
        finalCohorts,
        endYear - startYear,
        startYear,
        fertilityRate,
        infantMortalityRate,
        migrationRate,
        lifespan,
        numCohorts,
        cohortSize,
        true // Collect results during actual simulation
    ).results;
    
    // Ensure the first year's population is exactly the start population
    if (results.length > 0) {
        results[0].population = startPopulation;
    }
    
    return results;
}

// Extracted simulation logic function that can be reused for pre-simulation and actual simulation
function runSimulationCycle(initialCohorts, simulationYears, startYear, fertilityRate, infantMortalityRate, 
                          migrationRate, lifespan, numCohorts, cohortSize, collectResults = true) {
    const results = [];
    const yearStep = 1;
    let cohorts = [...initialCohorts]; // Create a copy to avoid modifying the original
    
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
    
    // Only log debug info during the actual simulation, not pre-simulation
    if (collectResults) {
        // Debug the rates
        console.log("Fertility Rate:", fertilityRate);
        console.log("Fertility Distribution:", fertilityDistribution);
        console.log("Survival Rates:", survivalRates);
        console.log("Effective Replacement Rate:", effectiveReplacementRate);
    }
    
    // Run simulation year by year
    for (let year = 0; year <= simulationYears; year += yearStep) {
        const currentYear = startYear + year;
        const totalPopulation = cohorts.reduce((a, b) => a + b, 0);
        
        // Calculate current year fertility rate (could be modified for time-dependent changes)
        const currentFertilityRate = fertilityRate;
        
        // Only collect results if requested (for the actual simulation, not pre-simulation)
        if (collectResults) {
            results.push({
                year: currentYear,
                population: totalPopulation,
                effectiveReplacementRate: effectiveReplacementRate
            });
        }
        
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
        
        // Debug info for every 10 years (only in actual simulation)
        if (collectResults && year % 10 === 0) {
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
    
    // Return both results and final cohort state
    return {
        results: results,
        finalCohorts: cohorts
    };
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

// Load parameters from URL
function loadParametersFromURL() {
    const params = new URLSearchParams(window.location.search);
    
    if (params.has('lifespan')) {
        lifespanSlider.value = params.get('lifespan');
        lifespanValue.textContent = lifespanSlider.value;
    }
    
    if (params.has('fertility')) {
        replacementSlider.value = params.get('fertility');
        replacementValue.textContent = replacementSlider.value;
    }
    
    if (params.has('childMortality')) {
        childMortalitySlider.value = params.get('childMortality');
        childMortalityValue.textContent = parseFloat(childMortalitySlider.value).toFixed(1);
    }
    
    if (params.has('migration')) {
        migrationSlider.value = params.get('migration');
        migrationValue.textContent = parseFloat(migrationSlider.value).toFixed(1);
    }
    
    if (params.has('startPopulation')) {
        startPopulationSlider.value = params.get('startPopulation');
        startPopulationValue.textContent = parseFloat(startPopulationSlider.value).toFixed(0);
    }
    
    if (params.has('endYear')) {
        endYearSlider.value = params.get('endYear');
        endYearValue.textContent = endYearSlider.value;
    }
}

// Draw a pixelated line or shape
function drawPixelatedLine(points, pixelSize, ctx, fillShape = false) {
    if (points.length === 0) return;
    
    // Sort points by longitude for filling
    if (fillShape) {
        // Group points by pixel rows for filling
        const rowPoints = {};
        
        for (const point of points) {
            const row = Math.floor(point.y / pixelSize) * pixelSize;
            if (!rowPoints[row]) {
                rowPoints[row] = [];
            }
            rowPoints[row].push(point);
        }
        
        // Fill each row with pixels
        for (const row in rowPoints) {
            const rowPixels = rowPoints[row];
            if (rowPixels.length >= 2) {
                // Sort by x coordinate
                rowPixels.sort((a, b) => a.x - b.x);
                
                // For each pair of points, fill the pixels between them
                for (let i = 0; i < rowPixels.length - 1; i += 2) {
                    const start = Math.floor(rowPixels[i].x / pixelSize) * pixelSize;
                    const end = Math.floor(rowPixels[i + 1].x / pixelSize) * pixelSize;
                    
                    for (let x = start; x <= end; x += pixelSize) {
                        ctx.fillRect(x, parseInt(row), pixelSize, pixelSize);
                    }
                }
            }
        }
    } else {
        // Draw individual pixels for lines
        for (const point of points) {
            const x = Math.floor(point.x / pixelSize) * pixelSize;
            const y = Math.floor(point.y / pixelSize) * pixelSize;
            ctx.fillRect(x, y, pixelSize, pixelSize);
        }
    }
}

// Default fallback country data (minimal version of what was in countries.js)
const fallbackCountryData = [
    {
        name: "United States",
        region: "northAmerica",
        polygon: [
            [-125.0, 48.0], [-125.0, 42.0], [-120.0, 37.0], [-115.0, 32.0], [-108.0, 31.0], 
            [-97.0, 26.0], [-80.0, 27.0], [-75.0, 37.0], [-77.0, 46.0], [-95.0, 49.0], [-125.0, 48.0]
        ]
    },
    {
        name: "Canada",
        region: "northAmerica",
        polygon: [
            [-141.0, 70.0], [-123.0, 49.0], [-95.0, 49.0], [-77.0, 46.0], [-53.0, 47.0], 
            [-53.0, 55.0], [-85.0, 75.0], [-120.0, 70.0], [-141.0, 70.0]
        ]
    },
    {
        name: "Brazil",
        region: "southAmerica",
        polygon: [
            [-69.5, 0.0], [-58.0, -8.0], [-46.0, -8.0], [-43.0, -22.0], [-48.0, -33.0], 
            [-57.5, -30.0], [-63.0, -17.0], [-71.0, -4.0], [-69.5, 0.0]
        ]
    },
    {
        name: "Russia",
        region: "asia",
        polygon: [
            [20.0, 55.0], [30.0, 60.0], [58.0, 70.0], [110.0, 76.0], [180.0, 68.0], 
            [172.0, 64.0], [142.0, 55.0], [130.0, 43.0], [96.0, 50.0], [60.0, 54.0], 
            [38.0, 50.0], [24.0, 52.5], [20.0, 55.0]
        ]
    },
    {
        name: "China",
        region: "asia",
        polygon: [
            [75.0, 40.0], [101.0, 45.0], [126.0, 47.0], [132.0, 43.0], [122.0, 31.0], 
            [108.0, 21.0], [95.0, 28.0], [80.0, 32.0], [75.0, 40.0]
        ]
    },
    {
        name: "Australia",
        region: "oceania",
        polygon: [
            [113.0, -12.0], [142.0, -12.0], [153.0, -30.0], [144.0, -40.0], [115.0, -32.0], [113.0, -12.0]
        ]
    }
];

// Load country GeoJSON data and convert it to simplified format for our map
let geoJSONCountries = [];

function loadGeoJSONCountries() {
    console.log("Starting to process embedded GeoJSON data...");
    
    try {
        // Use the embedded countriesGeoJSON data that was loaded from countries-data.js
        const data = countriesGeoJSON;
        
        // Log the structure of the data
        console.log("GeoJSON data structure:", 
                    Object.keys(data),
                    data.type,
                    data.features ? `Features count: ${data.features.length}` : "No features found");
        
        if (!data.features || !data.features.length) {
            throw new Error("Invalid GeoJSON data: No features found");
        }
        
        // Convert features to our simplified format
        const processedCountries = data.features.map((feature, index) => {
            try {
                // Get country name and properties
                const name = feature.properties.NAME || 
                            feature.properties.name || 
                            feature.properties.ADMIN || 
                            feature.properties.SOVEREIGNT || // This exists in the Natural Earth data
                            `Country ${index}`;
                
                // Skip Antarctica
                if (name === "Antarctica" || 
                    feature.properties.NAME === "Antarctica" || 
                    feature.properties.ADMIN === "Antarctica" ||
                    feature.properties.continent === "Antarctica" ||
                    feature.properties.CONTINENT === "Antarctica") {
                    return null;
                }
                
                // Get country ISO code for population API
                const isoCode = feature.properties.ISO_A3 || 
                               feature.properties.ISO_A2 || 
                               feature.properties.ADM0_A3;
                
                // Determine region from continent/region properties
                let region;
                
                // Specific handling for Natural Earth data which has CONTINENT property
                if (feature.properties.CONTINENT) {
                    switch(feature.properties.CONTINENT) {
                        case 'North America': region = 'northAmerica'; break;
                        case 'South America': region = 'southAmerica'; break;
                        case 'Europe': region = 'europe'; break;
                        case 'Africa': region = 'africa'; break;
                        case 'Asia': region = 'asia'; break;
                        case 'Oceania': case 'Australia': region = 'oceania'; break;
                        default: region = 'asia'; // Default fallback
                    }
                } 
                // Otherwise try to determine from region codes
                else if (feature.properties.ISO_A2 || feature.properties.ISO_A3) {
                    region = inferRegionFromProperties(feature.properties);
                }
                // Ultimate fallback
                else {
                    // Assign a region based on feature index to distribute colors evenly
                    const regions = ['northAmerica', 'southAmerica', 'europe', 'africa', 'asia', 'oceania'];
                    region = regions[index % regions.length];
                }
                
                // Simplify geometry - handle both Polygon and MultiPolygon
                let polygon = [];
                
                if (feature.geometry.type === 'Polygon') {
                    // Take the first (outer) ring of the polygon and simplify it
                    polygon = simplifyPolygon(feature.geometry.coordinates[0]);
                } 
                else if (feature.geometry.type === 'MultiPolygon') {
                    // Take the largest polygon from the multi-polygon
                    let largestPolygon = feature.geometry.coordinates[0][0];
                    let largestArea = calculatePolygonArea(largestPolygon);
                    
                    for (let i = 0; i < feature.geometry.coordinates.length; i++) {
                        const currentPolygon = feature.geometry.coordinates[i][0];
                        const currentArea = calculatePolygonArea(currentPolygon);
                        
                        if (currentArea > largestArea) {
                            largestPolygon = currentPolygon;
                            largestArea = currentArea;
                        }
                    }
                    
                    polygon = simplifyPolygon(largestPolygon);
                }
                
                // Add the original population if available
                const population = feature.properties.POP_EST || null;
                
                return {
                    name: name,
                    region: region,
                    polygon: polygon,
                    isoCode: isoCode,
                    population: population
                };
            } catch (err) {
                console.error(`Error processing feature ${index}:`, err);
                return null;
            }
        }).filter(country => country !== null);
        
        console.log("Successfully processed countries:", processedCountries.length);
        geoJSONCountries = processedCountries;
        return processedCountries; // Direct return, no Promise, since we're using sync processing
    } catch (error) {
        console.error("Error processing GeoJSON:", error);
        // Fallback to predefined country data
        console.log("Falling back to predefined country data");
        return fallbackCountryData; // Direct return, no Promise
    }
}

// Helper function to determine continent from properties when CONTINENT is missing
function determineContinent(properties) {
    // Use REGION_UN or SUBREGION if available
    if (properties.REGION_UN) {
        if (properties.REGION_UN === "Americas") {
            return properties.SUBREGION?.includes("South") ? "South America" : "North America";
        }
        return properties.REGION_UN;
    }
    
    // Try to infer continent from region or subregion
    if (properties.SUBREGION) {
        if (properties.SUBREGION.includes("Europe")) return "Europe";
        if (properties.SUBREGION.includes("Africa")) return "Africa";
        if (properties.SUBREGION.includes("Asia")) return "Asia";
        if (properties.SUBREGION.includes("America")) {
            return properties.SUBREGION.includes("South") ? "South America" : "North America";
        }
        if (properties.SUBREGION.includes("Australia") || properties.SUBREGION.includes("Oceania")) {
            return "Oceania";
        }
    }
    
    return "Unknown";
}

// Helper function to infer region from other properties
function inferRegionFromProperties(properties) {
    // Default fallback is to use 'asia' if we can't determine
    let region = 'asia';
    
    // Check common country code patterns
    if (properties.ISO_A2 || properties.ISO_A3) {
        const code = (properties.ISO_A2 || properties.ISO_A3).toUpperCase();
        
        // North American country codes
        if (['US', 'CA', 'MX', 'USA', 'CAN', 'MEX', 'GTM', 'BLZ', 'SLV', 'HND', 'NIC', 'CRI', 'PAN'].includes(code)) {
            region = 'northAmerica';
        }
        // South American country codes
        else if (['BR', 'AR', 'CO', 'PE', 'VE', 'CHL', 'ECU', 'BOL', 'PRY', 'URY', 'GUY', 'SUR', 'BRA', 'ARG', 'COL'].includes(code)) {
            region = 'southAmerica';
        }
        // European country codes
        else if (['GB', 'FR', 'DE', 'IT', 'ES', 'PL', 'RO', 'NL', 'BE', 'GR', 'CZ', 'PT', 'SE', 'HU', 'AT', 'CH', 'BG', 'DK', 'FI', 'SK', 'IE', 'HR', 'NO', 'LT', 'SI', 'LV', 'EE', 'CY', 'MT', 'LU', 'IS', 'GBR', 'FRA', 'DEU'].includes(code)) {
            region = 'europe';
        }
        // African country codes
        else if (['NG', 'EG', 'ZA', 'DZ', 'SD', 'MA', 'AO', 'ET', 'TZ', 'KE', 'UG', 'GH', 'MZ', 'ZW', 'ZMB', 'CMR', 'NGA', 'EGY', 'ZAF'].includes(code)) {
            region = 'africa';
        }
        // Oceania country codes
        else if (['AU', 'NZ', 'PG', 'FJ', 'SB', 'VU', 'WS', 'TO', 'FM', 'PW', 'MH', 'NR', 'TV', 'AUS', 'NZL', 'PNG'].includes(code)) {
            region = 'oceania';
        }
    }
    
    return region;
}

// Calculate approximate area of a polygon for finding the largest part of a MultiPolygon
function calculatePolygonArea(points) {
    let area = 0;
    for (let i = 0; i < points.length - 1; i++) {
        area += points[i][0] * points[i+1][1] - points[i+1][0] * points[i][1];
    }
    return Math.abs(area / 2);
}

// Simplify a polygon by reducing the number of points
function simplifyPolygon(points, maxPoints = 50) {
    // If the polygon is already small enough, return as is
    if (points.length <= maxPoints) {
        return points.map(point => [point[0], point[1]]);
    }
    
    // Calculate how many points to keep
    const factor = Math.max(1, Math.floor(points.length / maxPoints));
    
    // Create a new array with fewer points
    const simplified = [];
    for (let i = 0; i < points.length; i += factor) {
        // Convert GeoJSON [lon, lat] to our format
        simplified.push([points[i][0], points[i][1]]);
    }
    
    // Make sure we close the polygon properly by adding the first point at the end
    if (simplified.length > 0 && 
        (simplified[0][0] !== simplified[simplified.length - 1][0] || 
         simplified[0][1] !== simplified[simplified.length - 1][1])) {
        simplified.push([simplified[0][0], simplified[0][1]]);
    }
    
    // Ensure we have enough points for a proper polygon even after simplification
    if (simplified.length < 3) {
        // If we simplified too much, use more points
        return simplifyPolygon(points, maxPoints * 2);
    }
    
    return simplified;
}

// Initialize and draw the interactive world map
function initWorldMap() {
    // Setup the canvas for the world map
    setupCanvas();
    
    console.log("Initializing world map");
    
    // Create debugging information in the console
    console.log(`%c BOOMULATOR WORLD MAP %c Loading GeoJSON countries... `, 
                'background: #7dfdf9; color: #131e21; font-weight: bold;', 
                'background: #131e21; color: #7dfdf9;');
    
    // Show loading message on canvas
    if (worldMapCtx) {
        const width = worldMapCanvas.width / (window.devicePixelRatio || 1);
        const height = worldMapCanvas.height / (window.devicePixelRatio || 1);
        
        worldMapCtx.clearRect(0, 0, width, height);
        worldMapCtx.fillStyle = '#131e21';
        worldMapCtx.fillRect(0, 0, width, height);
        worldMapCtx.fillStyle = '#7dfdf9';
        worldMapCtx.font = '14px "Tiny5", monospace';
        worldMapCtx.textAlign = 'center';
        worldMapCtx.fillText('LOADING WORLD MAP...', width/2, height/2);
    }
    
    // We know we have embedded GeoJSON data, so process it immediately
    geoJSONCountries = []; // Reset in case of reinitialization
    
    // Process the country data
    try {
        // First attempt to draw with embedded data (synchronously)
        const countryData = loadGeoJSONCountries();
        
        // Log success
        console.log(`%c SUCCESS! %c Loaded ${countryData.length} countries `, 
                    'background: #5ae7b3; color: #131e21; font-weight: bold;', 
                    'background: #131e21; color: #5ae7b3;');
        
        // Draw the map without waiting for async operations
        drawWorldMap();
        
        // Setup mouse interaction for country highlighting
        setupWorldMapInteraction();
        
    } catch (err) {
        console.error(`%c ERROR! %c Failed to initialize world map: ${err.message}`, 
                      'background: #e14833; color: white; font-weight: bold;', 
                      'background: #131e21; color: #e14833;');
        
        // Try to draw with fallback data
        console.warn("Using fallback data for map");
        geoJSONCountries = []; // Ensure we use fallback
        drawWorldMap();
        setupWorldMapInteraction();
    }
}

// Define the standard world map aspect ratio (width:height)
const MAP_ASPECT_RATIO = 2.1; // Approximate aspect ratio of a mercator world map

// Draw the pixelated world map with countries
function drawWorldMap(highlightedCountry = null) {
    if (!worldMapCtx) return;
    
    // Get canvas dimensions
    const width = worldMapCanvas.width / (window.devicePixelRatio || 1);
    const height = worldMapCanvas.height / (window.devicePixelRatio || 1);
    
    // Clear the canvas
    worldMapCtx.clearRect(0, 0, width, height);
    
    // Background color
    worldMapCtx.fillStyle = '#131e21';
    worldMapCtx.fillRect(0, 0, width, height);
    
    // Define pixel size for pixelated look - even smaller for detailed country borders
    const pixelSize = 1.5;
    
    // Calculate map dimensions to maintain aspect ratio
    let mapWidth, mapHeight;
    
    if (width / height > MAP_ASPECT_RATIO) {
        // Container is wider than the map aspect ratio, so constrain by height
        mapHeight = height * 0.95;
        mapWidth = mapHeight * MAP_ASPECT_RATIO;
    } else {
        // Container is taller than the map aspect ratio, so constrain by width
        mapWidth = width * 0.95;
        mapHeight = mapWidth / MAP_ASPECT_RATIO;
    }
    
    // Shift the map to the left by 10% of the container width
    const mapX = (width - mapWidth) / 2 - (width * 0.1);
    const mapY = (height - mapHeight) / 2;
    
    // Choose which country data to use (GeoJSON or fallback)
    const dataToUse = geoJSONCountries.length > 0 ? geoJSONCountries : fallbackCountryData;
    
    // Import country data
    countries = dataToUse.map(country => {
        // Convert country coordinates to pixel coordinates
        const pixelPoints = country.polygon.map(([lon, lat]) => ({
            x: mapX + (lon + 180) / 360 * mapWidth,
            y: mapY + (90 - lat) / 180 * mapHeight
        }));
        
        // Calculate country bounding box for hit detection
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        pixelPoints.forEach(p => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        });
        
        // Store pixel coordinates and bounding box for interaction
        return {
            ...country,
            pixelPoints: pixelPoints,
            bounds: {minX, minY, maxX, maxY}
        };
    });
    
    // Region colors in terminal style
    const regionColors = {
        northAmerica: '#5ae7b3', // Green
        southAmerica: '#7dfdf9', // Cyan
        europe: '#eaffca',       // Yellow
        africa: '#e14833',       // Red
        asia: '#a0a9fe',         // Lavender
        oceania: '#f97e72'       // Salmon
    };
    
    // Draw each country
    countries.forEach(country => {
        if (highlightedCountry && highlightedCountry.name === country.name) {
            // Fill highlighted country
            worldMapCtx.fillStyle = '#ff3333';
            drawPixelatedPolygonFill(country.pixelPoints, pixelSize, worldMapCtx);
        } else {
            // Draw outline only for non-highlighted countries
            worldMapCtx.fillStyle = regionColors[country.region];
            drawPixelatedPolygonOutline(country.pixelPoints, pixelSize, worldMapCtx);
        }
    });
}

// Draw a pixelated polygon outline
function drawPixelatedPolygonOutline(points, pixelSize, ctx) {
    if (points.length < 3) return;
    
    // Draw each edge of the polygon with pixelated line segments
    for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length]; // Wrap around to close the polygon
        
        // Draw a pixelated line between p1 and p2
        drawPixelatedMapLine(p1, p2, pixelSize, ctx);
    }
}

// Draw a pixelated line between two points for map
function drawPixelatedMapLine(p1, p2, pixelSize, ctx) {
    // Bresenham's line algorithm adapted for pixelated rendering
    let x1 = Math.floor(p1.x / pixelSize) * pixelSize;
    let y1 = Math.floor(p1.y / pixelSize) * pixelSize;
    let x2 = Math.floor(p2.x / pixelSize) * pixelSize;
    let y2 = Math.floor(p2.y / pixelSize) * pixelSize;
    
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? pixelSize : -pixelSize;
    const sy = y1 < y2 ? pixelSize : -pixelSize;
    let err = dx - dy;
    
    while (true) {
        // Draw pixel at current position
        ctx.fillRect(x1, y1, pixelSize, pixelSize);
        
        // Break if we've reached the end point
        if (x1 === x2 && y1 === y2) break;
        
        // Calculate next position
        let e2 = 2 * err;
        if (e2 > -dy) {
            err -= dy;
            x1 += sx;
        }
        if (e2 < dx) {
            err += dx;
            y1 += sy;
        }
    }
}

// Fill a shape with pixelated style (for highlighting)
function drawPixelatedPolygonFill(points, pixelSize, ctx) {
    if (points.length < 3) return;
    
    // Find bounds of the shape
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    points.forEach(p => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    });
    
    // Snap to pixel grid
    minX = Math.floor(minX / pixelSize) * pixelSize;
    minY = Math.floor(minY / pixelSize) * pixelSize;
    maxX = Math.ceil(maxX / pixelSize) * pixelSize;
    maxY = Math.ceil(maxY / pixelSize) * pixelSize;
    
    // Pixelated fill algorithm - check each pixel in bounding box
    for (let y = minY; y <= maxY; y += pixelSize) {
        for (let x = minX; x <= maxX; x += pixelSize) {
            // Check if center of pixel is inside the polygon
            if (isPointInPolygon(x + pixelSize/2, y + pixelSize/2, points)) {
                ctx.fillRect(x, y, pixelSize, pixelSize);
            }
        }
    }
}

// Check if a point is inside a polygon using ray casting algorithm
function isPointInPolygon(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        
        const intersect = ((yi > y) !== (yj > y)) && 
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        
        if (intersect) inside = !inside;
    }
    return inside;
}

// Highlight a country in red
function highlightCountry(country) {
    if (!worldMapCtx || !country) return;
    
    // Redraw the map with the current country highlighted
    drawWorldMap(country);
    
    // Show country tooltip with enhanced information
    if (countryTooltip) {
        // Get region color class
        const regionClass = country.region.toLowerCase().replace(/\s+/g, '-');
        
        // Format population if available
        let populationInfo = '';
        if (country.population) {
            // Format population with commas (e.g., 1,234,567)
            const formattedPopulation = country.population.toLocaleString();
            populationInfo = `<div class="tooltip-population">Population: ${formattedPopulation}</div>`;
        }
        
        // Create tooltip content with region color indicator and population
        countryTooltip.innerHTML = `
            <div class="tooltip-header">
                <span class="tooltip-color ${regionClass}"></span>
                <span class="tooltip-name">${country.name}</span>
            </div>
            <div class="tooltip-region">${country.region}</div>
            ${populationInfo}
            <div class="tooltip-hint">Click to use population</div>
        `;
        countryTooltip.style.display = 'block';
    }
}

// Function to load population data from RestCountries API
function fetchCountryPopulation(country) {
    // If we already have population data from the GeoJSON
    if (country.population) {
        console.log(`Using GeoJSON population data for ${country.name}: ${country.population}`);
        updateStartPopulation(country.population);
        // Force tooltip to update with population data
        highlightCountry(country);
        return;
    }
    
    // Otherwise use the RestCountries API
    if (!country.isoCode) {
        console.warn(`No ISO code available for ${country.name}, can't fetch population data`);
        return;
    }
    
    // Show loading indicator in tooltip
    if (countryTooltip) {
        countryTooltip.innerHTML += `<div class="tooltip-loading">Loading population data...</div>`;
    }
    
    // Determine which API to use based on ISO code format
    let apiUrl;
    if (country.isoCode.length === 2) {
        apiUrl = `https://restcountries.com/v3.1/alpha/${country.isoCode}`;
    } else if (country.isoCode.length === 3) {
        apiUrl = `https://restcountries.com/v3.1/alpha/${country.isoCode}`;
    } else {
        apiUrl = `https://restcountries.com/v3.1/name/${encodeURIComponent(country.name)}`;
    }
    
    console.log(`Fetching population data for ${country.name} from ${apiUrl}`);
    
    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // API returns array for some endpoints
            const countryData = Array.isArray(data) ? data[0] : data;
            
            if (countryData && countryData.population) {
                const population = countryData.population;
                console.log(`Population of ${country.name}: ${population}`);
                
                // Store population in country data for future use
                country.population = population;
                
                // Update the start population slider
                updateStartPopulation(population);
                
                // Force tooltip to update with population data
                highlightCountry(country);
            } else {
                console.warn(`No population data found for ${country.name}`);
                tryWorldBankAPI(country);
            }
        })
        .catch(error => {
            console.error(`Error fetching population for ${country.name}:`, error);
            tryWorldBankAPI(country);
        });
}

// Separate function for the WorldBank API fallback
function tryWorldBankAPI(country) {
    if (!country.isoCode || country.isoCode.length !== 3) {
        console.warn("Can't use WorldBank API without a valid ISO-3 code");
        return;
    }
    
    const fallbackUrl = `https://api.worldbank.org/v2/country/${country.isoCode}?format=json`;
    console.log(`Trying fallback WorldBank API: ${fallbackUrl}`);
    
    // Update tooltip to show we're trying a fallback API
    if (countryTooltip) {
        const loadingEl = countryTooltip.querySelector('.tooltip-loading');
        if (loadingEl) {
            loadingEl.textContent = 'Trying alternate data source...';
        }
    }
    
    fetch(fallbackUrl)
        .then(response => response.json())
        .then(data => {
            if (data && data[1] && data[1][0] && data[1][0].population) {
                const population = data[1][0].population;
                console.log(`Population of ${country.name} from WorldBank: ${population}`);
                country.population = population;
                updateStartPopulation(population);
                
                // Force tooltip to update with population data
                highlightCountry(country);
            } else {
                console.warn("Failed to find population data from WorldBank API");
                // Update tooltip to show failure
                highlightCountry(country); // Refresh tooltip
            }
        })
        .catch(err => {
            console.error('WorldBank API fallback failed:', err);
            highlightCountry(country); // Refresh tooltip
        });
}

// Function to update the starting population value
function updateStartPopulation(population) {
    // Convert population to millions for the slider
    const popInMillions = Math.round(population / 1000000);
    
    // Update slider if population is within its range
    if (popInMillions >= startPopulationSlider.min && popInMillions <= startPopulationSlider.max) {
        startPopulationSlider.value = popInMillions;
        startPopulationValue.textContent = popInMillions;
        
        // Show a notification that population was updated
        const notification = document.createElement('div');
        notification.className = 'population-notification';
        notification.textContent = `Population set to ${popInMillions} million`;
        document.body.appendChild(notification);
        
        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.classList.add('fadeout');
            setTimeout(() => notification.remove(), 1000);
        }, 2000);
        
        // Run the simulation with updated population
        debounceUpdate(runSimulation);
    } else {
        console.warn(`Population ${popInMillions} million is outside slider range (${startPopulationSlider.min}-${startPopulationSlider.max})`);
    }
}

// Setup mouse interaction for the world map
function setupWorldMapInteraction() {
    let currentHoveredCountry = null;
    
    worldMapCanvas.addEventListener('mousemove', function(e) {
        const rect = worldMapCanvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Position the tooltip directly at the mouse position
        if (countryTooltip) {
            countryTooltip.style.left = `${e.clientX}px`;
            countryTooltip.style.top = `${e.clientY}px`;
        }
        
        // Check if mouse is over any country
        let hoveredCountry = null;
        
        // First do a quick bounding box check for efficiency
        for (const country of countries) {
            if (country.bounds) {
                const { minX, minY, maxX, maxY } = country.bounds;
                if (mouseX >= minX && mouseX <= maxX && mouseY >= minY && mouseY <= maxY) {
                    // Then do precise polygon check
                    if (isPointInPolygon(mouseX, mouseY, country.pixelPoints)) {
                        hoveredCountry = country;
                        break;
                    }
                }
            }
        }
        
        // Only redraw if the hovered country changed
        if (hoveredCountry !== currentHoveredCountry) {
            if (hoveredCountry) {
                highlightCountry(hoveredCountry);
            } else {
                // No country hovered, redraw the map and hide tooltip
                drawWorldMap();
                if (countryTooltip) {
                    countryTooltip.style.display = 'none';
                }
            }
            currentHoveredCountry = hoveredCountry;
        }
    });
    
    // Add click event for selecting country's population
    worldMapCanvas.addEventListener('click', function(e) {
        const rect = worldMapCanvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Check if click is on any country
        for (const country of countries) {
            if (country.bounds) {
                const { minX, minY, maxX, maxY } = country.bounds;
                if (mouseX >= minX && mouseX <= maxX && mouseY >= minY && mouseY <= maxY) {
                    // Then do precise polygon check
                    if (isPointInPolygon(mouseX, mouseY, country.pixelPoints)) {
                        // Country clicked - fetch population data
                        fetchCountryPopulation(country);
                        break;
                    }
                }
            }
        }
    });
    
    worldMapCanvas.addEventListener('mouseleave', function() {
        // Mouse left the canvas, redraw the map without highlight
        drawWorldMap();
        if (countryTooltip) {
            countryTooltip.style.display = 'none';
        }
        currentHoveredCountry = null;
    });
}

// Initialize application
function init() {
    initDomElements();
    loadParametersFromURL();
    setupEventListeners();
    runSimulation();
    initPixelationFilter();
    initWorldMap();
}

// Run initialization when document is loaded
window.addEventListener('load', init);

// Force redraw of map after a short delay to ensure it's visible
window.addEventListener('load', function() {
    // Redraw map after a short delay to ensure it's properly initialized
    setTimeout(function() {
        if (worldMapCtx) {
            console.log("Forcing map redraw to ensure visibility");
            drawWorldMap();
        }
    }, 500);
});