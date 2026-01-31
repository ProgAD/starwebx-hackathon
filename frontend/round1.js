const API_BASE_URL = 'http://localhost:8000/api';

// Application State
const state = {
    currentScreen: 'instructions', // instructions, exam, results
    currentSection: 'mcq', // mcq, programming
    
    // Timer
    totalTimeMinutes: 60,
    timeRemaining: 60 * 60, // seconds
    timerInterval: null,
    
    // MCQ
    mcqQuestions: [],
    currentMCQIndex: 0,
    mcqAnswers: {}, // { questionId: 'A/B/C/D' }
    
    // Programming
    programmingProblems: [],
    currentProblemIndex: 0,
    selectedLanguage: 'python',
    monacoEditor: null,
    programmingSubmissions: {}, // { problemId: { code, language, result } }
    codeResult: null,
    
    // Tab tracking
    tabActivityCount: 0,
    showTabWarning: false,
    isFullscreen: false,
    
    token: null
};

// Utility Functions
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function showScreen(screenName) {
    document.getElementById('instructionsScreen').style.display = 'none';
    document.getElementById('examScreen').style.display = 'none';
    document.getElementById('resultsScreen').style.display = 'none';
    
    if (screenName === 'instructions') {
        document.getElementById('instructionsScreen').style.display = 'block';
    } else if (screenName === 'exam') {
        document.getElementById('examScreen').style.display = 'flex';
    } else if (screenName === 'results') {
        document.getElementById('resultsScreen').style.display = 'block';
    }
    
    state.currentScreen = screenName;
}

function showSection(sectionName) {
    document.getElementById('mcqSection').style.display = 'none';
    document.getElementById('programmingSection').style.display = 'none';
    document.getElementById('mcqNavigation').style.display = 'none';
    document.getElementById('programmingNavigation').style.display = 'none';
    
    // Update tab buttons
    document.getElementById('mcqTab').classList.remove('border-purple-600', 'text-purple-600');
    document.getElementById('mcqTab').classList.add('text-gray-600');
    document.getElementById('programmingTab').classList.remove('border-purple-600', 'text-purple-600');
    document.getElementById('programmingTab').classList.add('text-gray-600');
    
    if (sectionName === 'mcq') {
        document.getElementById('mcqSection').style.display = 'block';
        document.getElementById('mcqNavigation').style.display = 'block';
        document.getElementById('mcqTab').classList.add('border-purple-600', 'text-purple-600');
        document.getElementById('mcqTab').classList.remove('text-gray-600');
    } else if (sectionName === 'programming') {
        document.getElementById('programmingSection').style.display = 'block';
        document.getElementById('programmingNavigation').style.display = 'block';
        document.getElementById('programmingTab').classList.add('border-purple-600', 'text-purple-600');
        document.getElementById('programmingTab').classList.remove('text-gray-600');
        
        // Initialize Monaco editor if not already done
        if (!state.monacoEditor) {
            initMonacoEditor();
        }
    }
    
    state.currentSection = sectionName;
}

// API Functions
async function loadMCQQuestions() {
    try {
        const response = await axios.get(`${API_BASE_URL}/stage1/mcq/questions`);
        state.mcqQuestions = response.data;
        renderMCQNavigation();
        renderCurrentMCQ();
    } catch (error) {
        console.error('Failed to load MCQ questions:', error);
        alert('Failed to load questions. Please refresh the page.');
    }
}

async function loadProgrammingProblems() {
    try {
        const response = await axios.get(`${API_BASE_URL}/stage1/programming/problems`);
        state.programmingProblems = response.data;
        renderProgrammingNavigation();
        renderCurrentProblem();
    } catch (error) {
        console.error('Failed to load programming problems:', error);
        alert('Failed to load programming problems. Please refresh the page.');
    }
}

async function submitMCQAnswer(questionId, selectedOption) {
    try {
        await axios.post(`${API_BASE_URL}/stage1/mcq/submit`, {
            question_id: questionId,
            selected_option: selectedOption,
            time_taken: null
        });
    } catch (error) {
        console.error('Failed to submit MCQ answer:', error);
    }
}

async function submitCode() {
    if (!state.monacoEditor) return;
    
    const code = state.monacoEditor.getValue();
    
    if (!code.trim()) {
        alert('Please write some code before submitting.');
        return;
    }
    
    try {
        document.getElementById('submitCodeBtn').disabled = true;
        document.getElementById('submitCodeBtn').textContent = 'Submitting...';
        const response = await axios.post(`${API_BASE_URL}/stage1/programming/submit`, {
            problem_id: state.programmingProblems[state.currentProblemIndex].id,
            code: code,
            language: state.selectedLanguage
        });
        
        state.codeResult = response.data.evaluation;
        state.programmingSubmissions[state.programmingProblems[state.currentProblemIndex].id] = {
            code: code,
            language: state.selectedLanguage,
            result: state.codeResult
        };
        
        renderCodeResult();
        renderProgrammingNavigation();
        alert(`Code submitted! Score: ${state.codeResult.score}/10`);
        
    } catch (error) {
        console.error('Failed to submit code:', error);
        alert('Failed to submit code. Please try again.');
    } finally {
        document.getElementById('submitCodeBtn').disabled = false;
        document.getElementById('submitCodeBtn').textContent = 'Submit Code';
    }
}

async function trackTabSwitch() {
    if (state.currentScreen === 'exam' && state.currentSection === 'programming' && state.programmingProblems[state.currentProblemIndex]) {
        try {
            const response = await axios.post(`${API_BASE_URL}/stage1/programming/track-tab`, null, {
                params: { problem_id: state.programmingProblems[state.currentProblemIndex].id }
            });
            state.tabActivityCount = response.data.tab_activity_count;
            
            // Update display
            document.getElementById('tabActivityCount').textContent = state.tabActivityCount;
            document.getElementById('tabWarningCount').textContent = state.tabActivityCount;
            
            // Show warning
            document.getElementById('tabWarning').style.display = 'block';
            setTimeout(() => {
                document.getElementById('tabWarning').style.display = 'none';
            }, 3000);
            
        } catch (error) {
            console.error('Failed to track tab switch:', error);
        }
    }
}

async function submitExam() {
    if (!confirm('Are you sure you want to submit the exam? You cannot make changes after submission.')) {
        return;
    }
    
    try {
        await axios.post(`${API_BASE_URL}/stage1/complete`);
        
        // Stop timer
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
        }
        
        // Exit fullscreen
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
        
        // Update results
        document.getElementById('mcqAttempted').textContent = Object.keys(state.mcqAnswers).length;
        document.getElementById('programmingSubmitted').textContent = Object.keys(state.programmingSubmissions).length;
        
        showScreen('results');
        
    } catch (error) {
        console.error('Failed to submit exam:', error);
        alert('Failed to submit exam. Please try again.');
    }
}

// Timer Functions
function startTimer() {
    state.timerInterval = setInterval(() => {
        state.timeRemaining--;
        
        const timerElement = document.getElementById('timer');
        timerElement.textContent = 'Time: ' + formatTime(state.timeRemaining);
        
        // Add warning class if less than 5 minutes
        if (state.timeRemaining < 300) {
            timerElement.classList.add('warning');
        }
        
        if (state.timeRemaining <= 0) {
            state.timeRemaining = 0;
            clearInterval(state.timerInterval);
            alert('Time is up! Exam will be auto-submitted.');
            submitExam();
        }
    }, 1000);
}

// Monaco Editor Functions
function initMonacoEditor() {
    require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' } });
    
    require(['vs/editor/editor.main'], () => {
        state.monacoEditor = monaco.editor.create(document.getElementById('monaco-editor'), {
            value: getStarterCode(),
            language: getMonacoLanguage(),
            theme: 'vs-dark',
            automaticLayout: true,
            fontSize: 14,
            minimap: { enabled: false }
        });
    });
}

function getMonacoLanguage() {
    const languageMap = {
        'python': 'python',
        'java': 'java',
        'cpp': 'cpp',
        'javascript': 'javascript'
    };
    return languageMap[state.selectedLanguage] || 'python';
}

function getStarterCode() {
    const currentProblem = state.programmingProblems[state.currentProblemIndex];
    if (!currentProblem) return '';
    
    const starterCodeMap = {
        'python': currentProblem.starter_code_python,
        'java': currentProblem.starter_code_java,
        'cpp': currentProblem.starter_code_cpp,
        'javascript': currentProblem.starter_code_javascript
    };
    
    return starterCodeMap[state.selectedLanguage] || '';
}

function loadStarterCode() {
    if (state.monacoEditor) {
        state.monacoEditor.setValue(getStarterCode());
        monaco.editor.setModelLanguage(state.monacoEditor.getModel(), getMonacoLanguage());
    }
}

// Render Functions
function renderMCQNavigation() {
    const nav = document.getElementById('mcqQuestionNav');
    nav.innerHTML = '';
    
    state.mcqQuestions.forEach((q, index) => {
        const btn = document.createElement('button');
        btn.textContent = `Q${index + 1}`;
        btn.className = 'question-btn';
        
        if (state.currentMCQIndex === index) {
            btn.classList.add('active');
        }
        if (state.mcqAnswers[q.id]) {
            btn.classList.add('answered');
        }
        
        btn.onclick = () => {
            state.currentMCQIndex = index;
            renderCurrentMCQ();
            renderMCQNavigation();
        };
        
        nav.appendChild(btn);
    });
}

function renderCurrentMCQ() {
    const currentMCQ = state.mcqQuestions[state.currentMCQIndex];
    if (!currentMCQ) return;
    
    document.getElementById('mcqQuestionTitle').textContent = `Question ${state.currentMCQIndex + 1} of ${state.mcqQuestions.length}`;
    document.getElementById('mcqMarks').textContent = `${currentMCQ.marks} mark`;
    document.getElementById('mcqQuestionText').textContent = currentMCQ.question_text;
    
    const optionsContainer = document.getElementById('mcqOptions');
    optionsContainer.innerHTML = '';
    
    ['A', 'B', 'C', 'D'].forEach(option => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        if (state.mcqAnswers[currentMCQ.id] === option) {
            btn.classList.add('selected');
        }
        
        btn.innerHTML = `<strong>${option}.</strong> ${currentMCQ['option_' + option.toLowerCase()]}`;
        btn.onclick = () => {
            state.mcqAnswers[currentMCQ.id] = option;
            renderCurrentMCQ();
            renderMCQNavigation();
        };
        
        optionsContainer.appendChild(btn);
    });
    
    // Update previous button
    const prevBtn = document.getElementById('previousMCQBtn');
    prevBtn.disabled = state.currentMCQIndex === 0;
}

function renderProgrammingNavigation() {
    const nav = document.getElementById('programmingQuestionNav');
    nav.innerHTML = '';
    
    state.programmingProblems.forEach((p, index) => {
        const btn = document.createElement('button');
        btn.textContent = `Question ${index + 1}`;
        btn.className = 'w-full py-2 px-3 rounded-lg text-left';
        
        if (state.currentProblemIndex === index) {
            btn.classList.add('bg-purple-600', 'text-white');
        } else if (state.programmingSubmissions[p.id]) {
            btn.classList.add('bg-green-200');
        } else {
            btn.classList.add('bg-gray-200');
        }
        
        btn.onclick = () => {
            state.currentProblemIndex = index;
            renderCurrentProblem();
            renderProgrammingNavigation();
            loadStarterCode();
        };
        
        nav.appendChild(btn);
    });
}

function renderCurrentProblem() {
    const problem = state.programmingProblems[state.currentProblemIndex];
    if (!problem) return;
    
    document.getElementById('problemTitle').textContent = problem.title;
    document.getElementById('problemDescription').textContent = problem.description;
    document.getElementById('problemInputFormat').textContent = problem.input_format;
    document.getElementById('problemOutputFormat').textContent = problem.output_format;
    document.getElementById('problemSampleInput').textContent = problem.sample_input;
    document.getElementById('problemSampleOutput').textContent = problem.sample_output;
    
    if (problem.constraints) {
        document.getElementById('problemConstraintsContainer').style.display = 'block';
        document.getElementById('problemConstraints').textContent = problem.constraints;
    } else {
        document.getElementById('problemConstraintsContainer').style.display = 'none';
    }
}

function renderCodeResult() {
    if (!state.codeResult) {
        document.getElementById('codeResultContainer').style.display = 'none';
        return;
    }
    
    const container = document.getElementById('codeResultContainer');
    container.style.display = 'block';
    
    if (state.codeResult.status === 'passed') {
        container.className = 'mt-4 p-4 rounded-lg bg-green-50 border border-green-300';
    } else {
        container.className = 'mt-4 p-4 rounded-lg bg-red-50 border border-red-300';
    }
    
    document.getElementById('codeResultStatus').textContent = state.codeResult.status.toUpperCase();
    document.getElementById('codeResultScore').textContent = state.codeResult.score;
    document.getElementById('codeResultFeedback').textContent = state.codeResult.feedback;
}

// Event Handlers
async function startExam() {
    try {
        // Enter fullscreen
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
            await elem.requestFullscreen();
        }
        
        state.isFullscreen = true;
        
        // Load questions
        await loadMCQQuestions();
        await loadProgrammingProblems();
        
        // Start timer
        startTimer();
        
        // Switch to exam screen
        showScreen('exam');
        showSection('mcq');
        
    } catch (error) {
        console.error('Failed to start exam:', error);
        alert('Failed to start exam. Please try again.');
    }
}

function previousMCQ() {
    if (state.currentMCQIndex > 0) {
        state.currentMCQIndex--;
        renderCurrentMCQ();
        renderMCQNavigation();
    }
}

async function saveAndNextMCQ() {
    const currentMCQ = state.mcqQuestions[state.currentMCQIndex];
    if (currentMCQ && state.mcqAnswers[currentMCQ.id]) {
        await submitMCQAnswer(currentMCQ.id, state.mcqAnswers[currentMCQ.id]);
    }
    
    if (state.currentMCQIndex < state.mcqQuestions.length - 1) {
        state.currentMCQIndex++;
        renderCurrentMCQ();
        renderMCQNavigation();
    }
}

function runCode() {
    alert('Code preview - AI evaluation happens on submit');
}

function returnToDashboard() {
    window.location.href = 'index.html';
}

function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }
    
    state.token = token;
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    
    // Event Listeners
    document.getElementById('startExamBtn').addEventListener('click', startExam);
    document.getElementById('mcqTab').addEventListener('click', () => showSection('mcq'));
    document.getElementById('programmingTab').addEventListener('click', () => showSection('programming'));
    document.getElementById('previousMCQBtn').addEventListener('click', previousMCQ);
    document.getElementById('nextMCQBtn').addEventListener('click', saveAndNextMCQ);
    document.getElementById('submitExamBtn').addEventListener('click', submitExam);
    document.getElementById('runCodeBtn').addEventListener('click', runCode);
    document.getElementById('submitCodeBtn').addEventListener('click', submitCode);
    document.getElementById('returnToDashboardBtn').addEventListener('click', returnToDashboard);
    
    // Language selector
    document.getElementById('languageSelect').addEventListener('change', (e) => {
        state.selectedLanguage = e.target.value;
        loadStarterCode();
    });
    
    // Track fullscreen changes
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement && state.currentScreen === 'exam') {
            state.isFullscreen = false;
            trackTabSwitch();
        } else {
            state.isFullscreen = true;
        }
    });
    
    // Track visibility changes (tab switches)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && state.currentScreen === 'exam') {
            trackTabSwitch();
        }
    });
    
    // Prevent right-click during exam
    document.addEventListener('contextmenu', (e) => {
        if (state.currentScreen === 'exam') {
            e.preventDefault();
        }
    });
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
    }
});
