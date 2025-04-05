document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded. Initializing Simple Stroop script...");

    // --- DOM Elements ---
    // Get references and check existence immediately
    const selectionScreen = document.getElementById('selectionScreen');
    const gameContainer = document.getElementById('gameContainer');
    const resultsArea = document.getElementById('resultsArea');
    const variantButtons = document.querySelectorAll('#selectionScreen .variant-buttons button'); // More specific selector
    const variantTitle = document.getElementById('variantTitle');
    const instructionsArea = document.getElementById('instructionsArea');
    const instructionText = document.getElementById('instructionText');
    const numTrialsSelect = document.getElementById('numTrialsSelect');
    const startGameButton = document.getElementById('startGameButton');
    const testArea = document.getElementById('testArea');
    const stimulusDisplay = document.getElementById('stimulusDisplay');
    const responseArea = document.getElementById('responseArea');
    const keyboardInstructions = document.getElementById('keyboardInstructions');
    const feedbackArea = document.getElementById('feedbackArea');
    const rtDisplay = document.getElementById('rtDisplay');
    const backToSelectionButton = document.getElementById('backToSelectionButton');
    const resultsVariantName = document.getElementById('resultsVariantName');
    const resultsSummary = document.getElementById('resultsSummary');
    const resultsExplanation = document.getElementById('resultsExplanation');
    const resultsButtonsContainer = document.getElementById('resultsButtonsContainer'); // Get existing container

    let initError = false;
    // Basic check for essential elements
     [selectionScreen, gameContainer, resultsArea, variantButtons, variantTitle, instructionsArea, instructionText, numTrialsSelect, startGameButton, testArea, stimulusDisplay, responseArea, keyboardInstructions, feedbackArea, rtDisplay, backToSelectionButton, resultsVariantName, resultsSummary, resultsExplanation, resultsButtonsContainer].forEach((el, i) => {
         const name = ["selectionScreen", "gameContainer", "resultsArea", "variantButtons", "variantTitle", "instructionsArea", "instructionText", "numTrialsSelect", "startGameButton", "testArea", "stimulusDisplay", "responseArea", "keyboardInstructions", "feedbackArea", "rtDisplay", "backToSelectionButton", "resultsVariantName", "resultsSummary", "resultsExplanation", "resultsButtonsContainer"][i];
         // For variantButtons, check length
         if (name === 'variantButtons' && (!el || el.length === 0)) {
             console.error(`FATAL ERROR: No elements found for '${name}'!`);
             initError = true;
         } else if (name !== 'variantButtons' && !el) {
             console.error(`FATAL ERROR: Element '${name}' not found!`);
             initError = true;
         } else {
              console.log(`Element '${name}' found.`);
         }
    });

    if (initError) {
        alert("שגיאה קריטית: רכיב חיוני חסר בדף ה-HTML. בדוק את ה-Console.");
        return; // Stop script execution
    }

    // --- Game State ---
    let currentVariant = null; // 'classic' or 'numerical'
    let gameState = 'selection';
    let trials = [];
    let currentTrialIndex = 0;
    let totalTrials = 20;
    let trialStartTime = 0;
    let resultsData = {};
    let responseListenerActive = false;
    let keyboardListener = null;
    let feedbackTimeout = null;
    let itiTimeout = null;

    // --- Variant Specific Settings ---
    const settings = {
        classic: {
            typeName: 'סטרופ קלאסי',
            colors: [
                { name: 'אדום', hex: '#e74c3c' }, { name: 'כחול', hex: '#3498db' },
                { name: 'ירוק', hex: '#2ecc71' }, { name: 'צהוב', hex: '#f1c40f' }
            ],
            feedbackDuration: 750, iti: 500, responseType: 'button'
        },
        numerical: {
            typeName: 'סטרופ מספרי',
            minNum: 1, maxNum: 9,
            sizes: [{ size: '28px', physicalValue: 1 }, { size: '64px', physicalValue: 2 }],
            feedbackDuration: 800, iti: 600, responseType: 'keyboard',
            keys: { ArrowLeft: 'left', ArrowRight: 'right' } // Response indicates which side has the LARGER NUMERICAL VALUE
        }
    };

    // --- Utility Functions ---
    function shuffleArray(array) { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[array[i], array[j]] = [array[j], array[i]]; } return array; }
    function calculateAverage(arr) { if (!arr || arr.length === 0) return 0; const sum = arr.reduce((a, b) => a + b, 0); return Math.round(sum / arr.length); }
    function calculateAccuracy(correct, count) { if (count === 0) return 0; return ((correct / count) * 100).toFixed(1); }

    function clearTimeouts() {
        if (feedbackTimeout) clearTimeout(feedbackTimeout);
        if (itiTimeout) clearTimeout(itiTimeout);
        feedbackTimeout = null;
        itiTimeout = null;
    }

    // --- Game State Management ---
    function updateGameState(newState) {
        console.log(`updateGameState: Switching state from ${gameState} to ${newState}`);
        const previousState = gameState;
        gameState = newState;

        selectionScreen.classList.toggle('hidden', newState !== 'selection');
        gameContainer.classList.toggle('hidden', newState === 'selection' || newState === 'results');
        resultsArea.classList.toggle('hidden', newState !== 'results');

        const isInstructions = newState === 'instructions';
        const isPlaying = newState === 'playing';
        const isResults = newState === 'results';
        const isSelection = newState === 'selection';

        instructionsArea.classList.toggle('hidden', !isInstructions);
        testArea.classList.toggle('hidden', !isPlaying);
        backToSelectionButton.classList.toggle('hidden', !isInstructions);
        resultsButtonsContainer.classList.toggle('hidden', !isResults);

        if (isSelection) {
            variantTitle.textContent = '';
            instructionText.innerHTML = '';
        }
        if (isResults) {
            setupResultButtons();
        }

        if (newState !== 'playing' && keyboardListener) {
            console.log("updateGameState: Removing keyboard listener");
            document.removeEventListener('keydown', keyboardListener);
            keyboardListener = null;
        }
        if ((previousState === 'playing' && !isPlaying) || isSelection) {
            clearTimeouts();
            responseListenerActive = false;
            console.log("updateGameState: Timeouts cleared and response listener deactivated.");
        }
        console.log(`updateGameState: Finished setting up state ${newState}`);
    }

    // --- Variant Selection ---
    variantButtons.forEach(button => {
        button.addEventListener('click', (event) => {
             const clickedButton = event.target.closest('button');
             if (!clickedButton) return;
             const variant = clickedButton.dataset.variant;
             console.log(`Variant button clicked: ${variant}`);

             if (settings[variant]) {
                 currentVariant = variant;
                 console.log(`currentVariant set to: ${currentVariant}`);
                 resultsData = {};
                 const prepSuccess = prepareInstructions(); // Call updated prepareInstructions
                 if (prepSuccess) {
                    updateGameState('instructions');
                 } else {
                     console.error("prepareInstructions failed, not updating game state.");
                     currentVariant = null; // Reset if failed
                 }
             } else {
                 console.error(`Variant "${variant}" not found in settings.`);
                 alert("שגיאה: הגרסה שנבחרה אינה תקינה.");
                 currentVariant = null;
             }
        });
    });

    // --- Instructions and Setup ---
    function prepareInstructions() {
        console.log(`--- prepareInstructions START for variant: ${currentVariant} ---`);
        if (!currentVariant || !settings[currentVariant]) {
             console.error(`prepareInstructions ERROR: Invalid currentVariant ('${currentVariant}') or missing settings.`);
             if(variantTitle) variantTitle.textContent = "שגיאה";
             if(instructionText) instructionText.innerHTML = "לא ניתן לטעון הוראות.";
             if(startGameButton) startGameButton.disabled = true;
             return false;
        }
        const config = settings[currentVariant];
        if (!variantTitle || !instructionText || !startGameButton) {
             console.error("prepareInstructions ERROR: Required DOM elements not found!");
             return false;
        }

        try {
            variantTitle.textContent = config.typeName || 'מבחן סטרופ'; // Use typeName from settings
            instructionText.innerHTML = getVariantInstructions(currentVariant);
            if (!instructionText.innerHTML) throw new Error("Instructions string is empty."); // Check if instructions were generated

            startGameButton.disabled = false;
            console.log("--- prepareInstructions SUCCESS ---");
            return true;
        } catch (error) {
             console.error("prepareInstructions ERROR during DOM update:", error);
             alert("שגיאה בעדכון ממשק ההוראות.");
             variantTitle.textContent = "שגיאה";
             instructionText.innerHTML = "לא ניתן היה לטעון את ההוראות.";
             startGameButton.disabled = true;
             return false;
        }
    }

    function getVariantInstructions(variant) {
         if (!variant || !settings[variant]) return "שגיאה: הוראות לא נמצאו.";
         switch (variant) {
            case 'classic': return "תופיע מילה צבועה בצבע מסוים. לחץ על הכפתור שמתאר את <strong>צבע הדיו</strong> של המילה, והתעלם ממשמעות המילה.";
            case 'numerical': return "יופיעו שתי ספרות בגדלים פיזיים שונים. לחץ על <strong>חץ שמאלה</strong> אם הספרה השמאלית <strong>גדולה יותר בערכה</strong>, ועל <strong>חץ ימינה</strong> אם הספרה הימנית <strong>גדולה יותר בערכה</strong>. התעלם מהגודל הפיזי.";
            default: return "הוראות לא מוגדרות עבור גרסה זו.";
         }
    }

    // --- Game Start ---
    startGameButton.addEventListener('click', () => {
        console.log("--- startGameButton CLICKED! ---");
        if (!currentVariant || !settings[currentVariant]) {
            console.error(`startGameButton ERROR: Cannot start game, currentVariant is invalid ('${currentVariant}') or settings are missing.`);
            alert("שגיאה: לא נבחרה גרסת ניסוי תקינה.");
            return;
        }
        console.log(`startGameButton: Attempting to start variant: ${currentVariant}`);
        totalTrials = parseInt(numTrialsSelect.value);
        console.log(`startGameButton: Starting variant: ${currentVariant} with ${totalTrials} trials.`);
        try {
             resultsData = createResultsObject(currentVariant);
             console.log("startGameButton: Results object created.");
             createTrials(); // Generate trials
             console.log(`startGameButton: Trials created (count: ${trials.length}).`);
             if (trials.length === 0 && totalTrials > 0) {
                 throw new Error(`יצירת הניסויים נכשלה או ייצרה 0 ניסויים עבור ${settings[currentVariant].typeName}.`);
             }
             setupResponseMechanism(); // Setup buttons or keyboard
             console.log("startGameButton: Response mechanism setup done.");
             updateGameState('playing'); // Switch view to playing area
             console.log("startGameButton: Game state updated to 'playing'. Calling displayNextTrial...");
             displayNextTrial(); // <<< START THE FIRST TRIAL >>>
             console.log("startGameButton: displayNextTrial called successfully.");
        } catch (error) {
             console.error(`startGameButton ERROR starting game for variant ${currentVariant}:`, error);
             alert(`שגיאה בהתחלת הניסוי: ${error.message}. נסה שוב או בחר גרסה אחרת.`);
             updateGameState('instructions'); // Back to instructions on error
        }
    });

    // --- Trial Generation ---
    function createTrials() {
        trials = [];
        currentTrialIndex = 0;
        console.log(`Creating trials for variant: ${currentVariant}`);
        if (currentVariant === 'classic') {
            createClassicTrials();
        } else if (currentVariant === 'numerical') {
            createNumericalTrials();
        } else {
            console.error(`Invalid variant for trial creation: ${currentVariant}`);
            throw new Error("גרסה לא תקינה ליצירת ניסויים.");
        }
        trials = shuffleArray(trials);
        console.log(`${trials.length} Trials created successfully.`);
        if (trials.length === 0 && totalTrials > 0) {
             console.warn(`Warning: 0 trials created for variant ${currentVariant} with ${totalTrials} requested.`);
             // No need to throw error here, caught in startGameButton listener
         }
    }

    function createClassicTrials() {
        const colors = settings.classic.colors;
        const trialsPerCondition = Math.floor(totalTrials / 2);
        if (trialsPerCondition === 0) console.warn("Classic: trialsPerCondition is 0");
        for (let i = 0; i < trialsPerCondition; i++) {
            const congruentIndex = Math.floor(Math.random() * colors.length);
            trials.push({ type: 'classic', word: colors[congruentIndex].name, color: colors[congruentIndex].hex, correctResponse: colors[congruentIndex].name, condition: 'congruent' });
            let wordIndex, colorIndex;
            do { wordIndex = Math.floor(Math.random() * colors.length); colorIndex = Math.floor(Math.random() * colors.length); } while (wordIndex === colorIndex);
            trials.push({ type: 'classic', word: colors[wordIndex].name, color: colors[colorIndex].hex, correctResponse: colors[colorIndex].name, condition: 'incongruent' });
        }
    }

    function createNumericalTrials() {
        const { minNum, maxNum, sizes } = settings.numerical;
        const trialsPerCondition = Math.floor(totalTrials / 2);
        if (trialsPerCondition === 0) console.warn("Numerical: trialsPerCondition is 0");
        for (let i = 0; i < trialsPerCondition; i++) {
            let num1, num2;
            do { num1 = Math.floor(Math.random() * (maxNum - minNum + 1)) + minNum; num2 = Math.floor(Math.random() * (maxNum - minNum + 1)) + minNum; } while (num1 === num2);
            const size1Cong = (num1 > num2) ? sizes[1] : sizes[0]; const size2Cong = (num1 > num2) ? sizes[0] : sizes[1];
            const size1Incong = (num1 > num2) ? sizes[0] : sizes[1]; const size2Incong = (num1 > num2) ? sizes[1] : sizes[0];
            const correctResponse = (num1 > num2) ? 'left' : 'right'; // Correct response indicates which side has LARGER VALUE

            if (Math.random() < 0.5) { // num1 on left
                trials.push({ type: 'numerical', numL: num1, numR: num2, sizeL: size1Cong.size, sizeR: size2Cong.size, correctResponse: correctResponse, condition: 'congruent'});
                trials.push({ type: 'numerical', numL: num1, numR: num2, sizeL: size1Incong.size, sizeR: size2Incong.size, correctResponse: correctResponse, condition: 'incongruent'});
             } else { // num2 on left
                 const correctResponseFlipped = correctResponse === 'left' ? 'right' : 'left';
                 trials.push({ type: 'numerical', numL: num2, numR: num1, sizeL: size2Cong.size, sizeR: size1Cong.size, correctResponse: correctResponseFlipped, condition: 'congruent'});
                 trials.push({ type: 'numerical', numL: num2, numR: num1, sizeL: size2Incong.size, sizeR: size1Incong.size, correctResponse: correctResponseFlipped, condition: 'incongruent'});
            }
        }
    }

    // --- Response Mechanism Setup ---
    function setupResponseMechanism() {
        responseArea.innerHTML = '';
        keyboardInstructions.classList.add('hidden');
        if (!currentVariant || !settings[currentVariant]) return; // Safety check
        const config = settings[currentVariant];

        if (config.responseType === 'button') {
            const colorsToUse = config.colors;
            colorsToUse.forEach(color => {
                const button = document.createElement('button');
                button.textContent = color.name;
                button.dataset.responseValue = color.name;
                button.classList.add(`color-button-${color.name}`);
                if (color.name === 'צהוב') { button.style.color = '#333'; }
                button.addEventListener('click', handleButtonClick);
                responseArea.appendChild(button);
            });
             console.log("Button response mechanism setup.");
        } else if (config.responseType === 'keyboard') {
            keyboardInstructions.textContent = getKeyboardInstruction(currentVariant);
            keyboardInstructions.classList.remove('hidden');
            if (keyboardListener) { document.removeEventListener('keydown', keyboardListener); }
            keyboardListener = handleKeyPress;
            document.addEventListener('keydown', keyboardListener);
             console.log("Keyboard response mechanism setup.");
        }
    }

    function getKeyboardInstruction(variant) {
        if (!variant || !settings[variant]) return "";
         switch (variant) {
             case 'numerical': return "השתמש במקשי החצים: ← (שמאל גדול בערכו) | → (ימין גדול בערכו)";
             default: return ""; // Only numerical uses keyboard here
         }
     }

    // --- Stimulus Rendering ---
    function renderStimulus(trial) {
        console.log("Rendering stimulus for trial:", trial);
        stimulusDisplay.innerHTML = '';
        stimulusDisplay.className = '';
        stimulusDisplay.style.cssText = '';

        if (!trial || !trial.type) {
            console.error("Invalid trial data in renderStimulus:", trial);
            feedbackArea.textContent = "שגיאה בהצגת הגירוי.";
            feedbackArea.className = 'feedback-text feedback-incorrect';
            currentTrialIndex++;
            feedbackTimeout = setTimeout(displayNextTrial, 1500);
            return;
        }

        try {
            switch (trial.type) {
                case 'classic':
                    stimulusDisplay.textContent = trial.word;
                    stimulusDisplay.style.color = trial.color;
                    break;
                case 'numerical':
                    stimulusDisplay.classList.add('numerical-stimulus');
                    const spanL = document.createElement('span'); spanL.textContent = trial.numL; spanL.style.fontSize = trial.sizeL;
                    const spanR = document.createElement('span'); spanR.textContent = trial.numR; spanR.style.fontSize = trial.sizeR;
                    stimulusDisplay.appendChild(spanL); stimulusDisplay.appendChild(spanR);
                    break;
                default:
                    throw new Error(`Unknown trial type: ${trial.type}`);
            }
            console.log("Stimulus rendered.");
        } catch (error) {
             console.error("Error during specific stimulus rendering:", error);
             feedbackArea.textContent = "שגיאה בהצגת הגירוי.";
             feedbackArea.className = 'feedback-text feedback-incorrect';
             currentTrialIndex++;
             feedbackTimeout = setTimeout(displayNextTrial, 1500);
        }
    }

    // --- Trial Execution ---
    function displayNextTrial() {
        clearTimeouts();
        console.log(`--- displayNextTrial START for index: ${currentTrialIndex} (Total: ${trials.length}) ---`);

        if (currentTrialIndex >= trials.length) {
            console.log("displayNextTrial: No more trials, calling showResults.");
            showResults();
            return;
        }

        const trial = trials[currentTrialIndex];
        if (!currentVariant || !settings[currentVariant]) { console.error(`displayNextTrial ERROR: Invalid variant/settings.`); updateGameState('instructions'); return; }
        const config = settings[currentVariant];
        if (!trial) { console.error(`displayNextTrial ERROR: Trial data missing for index ${currentTrialIndex}.`); currentTrialIndex++; displayNextTrial(); return; }

        feedbackArea.textContent = '';
        feedbackArea.className = 'feedback-text';
        rtDisplay.textContent = 'זמן תגובה: --';
        stimulusDisplay.style.visibility = 'hidden'; // Hide before timeout

        console.log(`displayNextTrial: Setting ITI timeout for ${config.iti}ms`);
        itiTimeout = setTimeout(() => {
            console.log(`--- displayNextTrial ITI TIMEOUT CALLBACK --- (State: ${gameState})`);
            if (gameState !== 'playing') { console.log("displayNextTrial Callback: State is not 'playing', exiting."); return; }
            console.log("displayNextTrial Callback: Rendering stimulus...");
             try {
                renderStimulus(trial);
                stimulusDisplay.style.visibility = 'visible'; // Show after rendering
                trialStartTime = performance.now();
                responseListenerActive = true;
                console.log("displayNextTrial Callback: Stimulus visible, listener active.");
            } catch(error) {
                 console.error("Error rendering stimulus in callback:", error);
                 // Try to recover by moving to next trial after showing error
                 feedbackArea.textContent = "שגיאה בהצגת הגירוי.";
                 feedbackArea.className = 'feedback-text feedback-incorrect';
                 currentTrialIndex++;
                 feedbackTimeout = setTimeout(displayNextTrial, 1500);
             }
        }, config.iti);

        console.log("--- displayNextTrial END (Timeout scheduled) ---");
    }

    // --- Response Handling ---
    function handleButtonClick(event) {
        if (gameState !== 'playing' || !responseListenerActive) return;
        const responseValue = event.target.dataset.responseValue;
        processResponse(responseValue);
    }

    function handleKeyPress(event) {
        if (gameState !== 'playing' || !responseListenerActive) return;
        if (!currentVariant || !settings[currentVariant]) return;
        const config = settings[currentVariant];
        if (config.keys && config.keys[event.key]) {
           const responseValue = config.keys[event.key];
           processResponse(responseValue, event.key);
       } else {
           // console.log("Ignoring irrelevant key press:", event.key);
       }
   }

    function processResponse(responseValue, keyPressed = null) {
        if (!responseListenerActive) { console.log("ProcessResponse called but listener was inactive."); return; }
        responseListenerActive = false;
        clearTimeouts();

        const endTime = performance.now();
        const reactionTime = Math.round(endTime - trialStartTime);
        if (!trials || currentTrialIndex >= trials.length) { console.error("ProcessResponse error: Invalid trial index or trials array."); return; }
        const trial = trials[currentTrialIndex];
        if (!currentVariant || !settings[currentVariant]) { console.error("ProcessResponse error: Invalid current variant or settings."); return; }
        const config = settings[currentVariant];

        let isCorrect = false;
        try {
             switch (currentVariant) {
                 case 'classic': isCorrect = responseValue === trial.correctResponse; break;
                 case 'numerical': isCorrect = responseValue === trial.correctResponse; break; // responseValue is 'left'/'right'
                 default: console.warn("Unknown variant in correctness check");
             }
        } catch (error) { console.error("Error calculating correctness:", error); isCorrect = false; }

        console.log(`Trial ${currentTrialIndex + 1} Resp: ${responseValue} (Key: ${keyPressed}), CorrectResp: ${trial.correctResponse}, Correct: ${isCorrect}, RT: ${reactionTime}ms`);
        rtDisplay.textContent = `זמן תגובה: ${reactionTime}ms`;

        recordResult(trial, isCorrect, reactionTime);

        feedbackArea.textContent = isCorrect ? 'נכון!' : 'טעות!';
        feedbackArea.className = `feedback-text feedback-${isCorrect ? 'correct' : 'incorrect'}`;

        currentTrialIndex++;

        const feedbackDur = config ? config.feedbackDuration : 750;
        feedbackTimeout = setTimeout(() => {
             console.log("Feedback timeout done, calling displayNextTrial");
            displayNextTrial();
        }, feedbackDur);
    }

    // --- Result Recording & Calculation ---
    function createResultsObject(variant) {
        let data = { all: { rt: [], correct: 0, count: 0 } };
        if (variant === 'classic' || variant === 'numerical') {
            data.congruent = { rt: [], correct: 0, count: 0 };
            data.incongruent = { rt: [], correct: 0, count: 0 };
        }
        // Add other variant structures here if needed later
        return data;
    }

    function recordResult(trial, isCorrect, rt) {
         if (!resultsData || !resultsData.all || !trial) return;
         const condition = trial.condition; // 'congruent' or 'incongruent'

         resultsData.all.count++;
         if (isCorrect) { resultsData.all.correct++; resultsData.all.rt.push(rt); }

         if (resultsData[condition]) {
             resultsData[condition].count++;
             if (isCorrect) { resultsData[condition].correct++; resultsData[condition].rt.push(rt); }
         } else {
              console.warn(`Result condition "${condition}" not found in resultsData structure for variant "${currentVariant}"`);
         }
    }

    function formatResults() {
        let html = `<p><strong>סה"כ ניסויים:</strong><span>${resultsData.all.count}</span></p>`;
        html += `<p><strong>דיוק כולל:</strong><span>${calculateAccuracy(resultsData.all.correct, resultsData.all.count)}%</span></p>`;
        html += `<p><strong>זמן תגובה ממוצע (נכון):</strong><span>${calculateAverage(resultsData.all.rt)} ms</span></p>`;
        html += `<hr style="border-top: 1px dashed #ccc; margin: 10px 0;">`;

        let explanation = "";

        if (currentVariant === 'classic' || currentVariant === 'numerical') {
            const congRT = calculateAverage(resultsData.congruent.rt);
            const incongRT = calculateAverage(resultsData.incongruent.rt);
            const congAcc = calculateAccuracy(resultsData.congruent.correct, resultsData.congruent.count);
            const incongAcc = calculateAccuracy(resultsData.incongruent.correct, resultsData.incongruent.count);
            const effect = (congRT > 0 && incongRT > 0) ? incongRT - congRT : 0;
            html += `<p><strong>תואם (Congruent):</strong> RT=<span>${congRT} ms</span>, Acc=<span>${congAcc}%</span></p>`;
            html += `<p><strong>לא תואם (Incongruent):</strong> RT=<span>${incongRT} ms</span>, Acc=<span>${incongAcc}%</span></p>`;
            html += `<p><strong>אפקט סטרופ (הפרש RT):</strong><span style="color:#d81b60; font-weight:bold;">${effect} ms</span></p>`;
             explanation = `אפקט סטרופ בא לידי ביטוי בזמן תגובה ארוך יותר ו/או דיוק נמוך יותר בתנאים הלא-תואמים, כאשר המידע הלא-רלוונטי (משמעות המילה או גודל פיזי) מפריע לעיבוד המידע הרלוונטי (צבע דיו או ערך מספרי).`;
        }
        return { summary: html, explanation: explanation };
    }

    // --- Show Final Results ---
    function showResults() {
        console.log("Showing results for variant:", currentVariant);
        if (!resultsData || !resultsData.all) {
             console.error("Results data is missing or invalid.");
             resultsSummary.innerHTML = "<p>שגיאה באיסוף התוצאות.</p>";
             resultsExplanation.textContent = "";
        } else {
             const { summary, explanation } = formatResults();
             resultsVariantName.textContent = settings[currentVariant]?.typeName || currentVariant; // Use typeName
             resultsSummary.innerHTML = summary;
             resultsExplanation.textContent = explanation;
        }
        updateGameState('results'); // Update state *after* content is ready
    }

     // --- כפתורים במסך תוצאות ---
     function setupResultButtons() {
         if (!resultsButtonsContainer) return;
         resultsButtonsContainer.innerHTML = ''; // Clear previous

         const retryButton = document.createElement('button');
         retryButton.textContent = 'נסה שוב (אותה גרסה)';
         retryButton.style.marginRight = '10px';
         retryButton.style.backgroundColor = '#ffc107'; retryButton.style.color = '#333';
         retryButton.addEventListener('click', () => {
             console.log("Retry button clicked");
             if (currentVariant) {
                 prepareInstructions(); // Prepare instructions again
                 updateGameState('instructions');
             } else { goBackToSelection(); }
         });
         resultsButtonsContainer.appendChild(retryButton);

         const backButton = document.createElement('button');
         backButton.textContent = 'חזור לבחירת גרסה';
         backButton.style.backgroundColor = '#6c757d';
         backButton.addEventListener('click', goBackToSelection);
         resultsButtonsContainer.appendChild(backButton);
     }

    // --- Back Button Logic ---
    function goBackToSelection() {
        console.log("goBackToSelection function CALLED!");
        try {
             updateGameState('selection');
             if(variantTitle) variantTitle.textContent = '';
             if(instructionText) instructionText.innerHTML = '';
             if(stimulusDisplay) stimulusDisplay.innerHTML = '';
             if(responseArea) responseArea.innerHTML = '';
             if(feedbackArea) feedbackArea.textContent = '';
             if(rtDisplay) rtDisplay.textContent = 'זמן תגובה: --';
             if(keyboardInstructions) keyboardInstructions.classList.add('hidden');
             resultsData = {};
             currentVariant = null;
             trials = [];
             currentTrialIndex = 0;
             console.log("State updated to selection, relevant state reset.");
        } catch (error) {
             console.error("Error during goBackToSelection:", error);
             alert("שגיאה בחזרה למסך הבחירה.");
        }
    }
    if (backToSelectionButton) { backToSelectionButton.addEventListener('click', goBackToSelection); }

    // --- Initial Setup ---
    // Run initial state setup only if no critical errors occurred
    if (!initError) {
         console.log("Running initial updateGameState('selection').");
         updateGameState('selection');
    } else {
         console.error("Skipping initial updateGameState due to initialization errors.");
    }
    console.log("Stroop Simple script loaded and initialization attempt finished.");

}); // סוף DOMContentLoaded