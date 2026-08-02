const DICE_TYPES = ['proficiency', 'ability', 'boost', 'challenge', 'difficulty', 'setback'];
const MIN_DICE = 0;
const MAX_DICE = 10;

const DICE_FACES = {
    boost: [
        {},
        {},
        { success: 1 },
        { success: 1, advantage: 1 },
        { advantage: 2 },
        { advantage: 1 }
    ],
    setback: [
        {},
        {},
        { failure: 1 },
        { failure: 1 },
        { threat: 1 },
        { threat: 1 }
    ],
    ability: [
        {},
        { success: 1 },
        { success: 1 },
        { success: 2 },
        { advantage: 1 },
        { advantage: 1 },
        { success: 1, advantage: 1 },
        { advantage: 2 }
    ],
    difficulty: [
        {},
        { failure: 1 },
        { failure: 2 },
        { threat: 1 },
        { threat: 1 },
        { threat: 1 },
        { threat: 2 },
        { failure: 1, threat: 1 }
    ],
    proficiency: [
        {},
        { success: 1 },
        { success: 1 },
        { success: 2 },
        { success: 2 },
        { advantage: 1 },
        { success: 1, advantage: 1 },
        { success: 1, advantage: 1 },
        { success: 1, advantage: 1 },
        { advantage: 2 },
        { advantage: 2 },
        { triumph: 1 }
    ],
    challenge: [
        {},
        { failure: 1 },
        { failure: 1 },
        { failure: 2 },
        { failure: 2 },
        { threat: 1 },
        { threat: 1 },
        { failure: 1, threat: 1 },
        { failure: 1, threat: 1 },
        { threat: 2 },
        { threat: 2 },
        { despair: 1 }
    ]
};

function createEmptyTotals() {
    return {
        success: 0,
        advantage: 0,
        triumph: 0,
        despair: 0,
        failure: 0,
        threat: 0
    };
}

/**
 * Adjusts the value of a dice input field.
 * @param {*} diceType - The type of dice (e.g., proficiency, ability). Correlates to the ID of the input element.
 * @param {*} change - The amount to change the dice value by (can be positive or negative).
 */
function adjustDice(diceType, change) {
    const input = document.getElementById(diceType);
    if (!input) return;

    const currentValue = readDiceInput(diceType);
    input.value = clampDiceCount(currentValue + change);
}

function clampDiceCount(value) {
    const parsedValue = Number(value);
    if (!Number.isFinite(parsedValue)) return MIN_DICE;

    const integerValue = Math.trunc(parsedValue);
    return Math.max(MIN_DICE, Math.min(MAX_DICE, integerValue));
}

function readDiceInput(diceType) {
    const input = document.getElementById(diceType);
    if (!input) return MIN_DICE;

    const normalizedValue = clampDiceCount(input.value);
    input.value = normalizedValue;
    return normalizedValue;
}

function getDicePool() {
    return Object.fromEntries(DICE_TYPES.map((type) => [type, readDiceInput(type)]));
}

/**
 * Clears all dice input fields and hides the results section.
 */
function clearDice() {
    DICE_TYPES.forEach(type => {
        const input = document.getElementById(type);
        if (input) input.value = MIN_DICE;
    });

    const results = document.getElementById('results');
    if (results) results.style.display = 'none';
}

/**
 * Rolls the dice (simulateRoll function) based on the values in the input fields and displays the results (displayResults function).
 */
function rollDice() {
    const pool = getDicePool();
    const results = simulateRoll(pool.proficiency, pool.ability, pool.boost, pool.challenge, pool.difficulty, pool.setback);
    console.table(results);
    displayResults(results);
}

function addSymbols(totals, symbols) {
    Object.entries(symbols).forEach(([symbol, count]) => {
        totals[symbol] += count;
    });
}

function rollDie(diceType, totals) {
    const faces = DICE_FACES[diceType];
    const face = faces[Math.floor(Math.random() * faces.length)];
    addSymbols(totals, face);
}

function rollDiceType(diceType, count, totals) {
    for (let i = 0; i < clampDiceCount(count); i++) {
        rollDie(diceType, totals);
    }
}

/**
 * Simulates a dice roll based on the number of dice all input fields.
 * @param {Number} prof - The number of proficiency dice.
 * @param {Number} abil - The number of ability dice.
 * @param {Number} boost - The number of boost dice.
 * @param {Number} chal - The number of challenge dice.
 * @param {Number} diff - The number of difficulty dice.
 * @param {Number} setb - The number of setback dice.
 * @returns {Object} - An object containing the raw results all dice rolls, which is then passed to displayResults from rollDice.
 */
function simulateRoll(prof, abil, boost, chal, diff, setb) {
    const totals = createEmptyTotals();

    rollDiceType('boost', boost, totals);
    rollDiceType('setback', setb, totals);
    rollDiceType('ability', abil, totals);
    rollDiceType('difficulty', diff, totals);
    rollDiceType('proficiency', prof, totals);
    rollDiceType('challenge', chal, totals);

    return totals;
}

function normalizeResults(results) {
    const normalizedResults = { ...results };
    const totalSuccess = normalizedResults.success + normalizedResults.triumph;
    const totalFailure = normalizedResults.failure + normalizedResults.despair;
    const netSuccess = Math.max(0, totalSuccess - totalFailure);
    const netFailure = Math.max(0, totalFailure - totalSuccess);

    // Triumph and Despair each contribute one success/failure to the net result,
    // while their special events remain visible and do not cancel each other.
    normalizedResults.success = netSuccess;
    normalizedResults.failure = netFailure;

    normalizedResults.advantage -= normalizedResults.threat;
    if (normalizedResults.advantage < 0) {
        normalizedResults.threat = Math.abs(normalizedResults.advantage);
        normalizedResults.advantage = 0;
    } else {
        normalizedResults.threat = 0;
    }

    return {
        normalizedResults,
        netSuccess,
        netFailure
    };
}

function createBadge(className, label, value) {
    const badge = document.createElement('span');
    badge.className = `badge ${className} me-2`;
    badge.textContent = `${label}: ${value}`;
    return badge;
}

function createInterpretation(netSuccess, netFailure, results) {
    const interpretation = document.createElement('div');
    const specialEvents = [];
    if (results.triumph > 0) specialEvents.push('Triumph');
    if (results.despair > 0) specialEvents.push('Despair');
    const eventText = specialEvents.length > 0 ? ` ${specialEvents.join(' and ')} event${specialEvents.length > 1 ? 's' : ''} triggered.` : '';

    if (netSuccess > netFailure) {
        interpretation.className = 'alert alert-success';
        interpretation.textContent = `The action succeeds with ${netSuccess} net Success.${eventText}`;
    } else {
        interpretation.className = 'alert alert-danger';
        interpretation.textContent = netFailure > 0
            ? `The action fails with ${netFailure} net Failure.${eventText}`
            : `The action fails with no net Success.${eventText}`;
    }

    return interpretation;
}

/**
 * Displays the results of the dice roll and adds an interpretation of the results to the results section.
 * @param {Object} results - The raw results of all dice rolls from simulateRoll.
 */
function displayResults(results) {
    const resultsDiv = document.getElementById('results');
    const summaryDiv = document.getElementById('resultsSummary');
    const detailsDiv = document.getElementById('resultsDetails');

    if (!resultsDiv || !summaryDiv || !detailsDiv) return;

    const { normalizedResults, netSuccess, netFailure } = normalizeResults(results);
    const summaryFragment = document.createDocumentFragment();

    if (normalizedResults.success > 0) {
        summaryFragment.appendChild(createBadge('bg-success', 'Net Success', normalizedResults.success));
    }
    if (normalizedResults.failure > 0) {
        summaryFragment.appendChild(createBadge('bg-danger', 'Net Failure', normalizedResults.failure));
    }
    if (normalizedResults.advantage > 0) {
        summaryFragment.appendChild(createBadge('bg-info', 'Advantage', normalizedResults.advantage));
    }
    if (normalizedResults.threat > 0) {
        summaryFragment.appendChild(createBadge('bg-orange', 'Threat', normalizedResults.threat));
    }
    if (normalizedResults.triumph > 0) {
        summaryFragment.appendChild(createBadge('bg-warning', 'Triumph', normalizedResults.triumph));
    }
    if (normalizedResults.despair > 0) {
        summaryFragment.appendChild(createBadge('bg-dark', 'Despair', normalizedResults.despair));
    }

    if (!summaryFragment.hasChildNodes()) {
        const noResults = document.createElement('span');
        noResults.className = 'text-muted';
        noResults.textContent = 'No significant results';
        summaryFragment.appendChild(noResults);
    }

    summaryDiv.replaceChildren(summaryFragment);
    detailsDiv.replaceChildren(createInterpretation(netSuccess, netFailure, normalizedResults));
    resultsDiv.style.display = 'block';
}

// Initialize page
document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-dice-adjust]').forEach((button) => {
        button.addEventListener('click', () => {
            const change = Number(button.dataset.diceChange);
            adjustDice(button.dataset.diceAdjust, Number.isFinite(change) ? Math.trunc(change) : 0);
        });
    });

    document.querySelectorAll('[data-dice-action="roll"]').forEach((button) => {
        button.addEventListener('click', rollDice);
    });

    document.querySelectorAll('[data-dice-action="clear"]').forEach((button) => {
        button.addEventListener('click', clearDice);
    });

    document.querySelectorAll('.dice-controls input[type="number"]').forEach((input) => {
        input.addEventListener('change', () => readDiceInput(input.id));
    });

    console.log("Dice roller is ready for use.");
});
