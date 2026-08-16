// ------------------------------------------------------------------
// AI STUDY BUDDY - App shell: routing, session, bottom navigation.
// Screens live in js/screens/*.js and export a default render fn:
//   (container, params, app) => void
// ------------------------------------------------------------------

import { isAuthed, getUser, setUser, setToken, API } from './api.js';
import { toast } from './ui.js';

import onboardingScreen from './screens/onboarding.js';
import loginScreen from './screens/login.js';
import signupScreen from './screens/signup.js';
import forgotScreen from './screens/forgot.js';
import homeScreen from './screens/home.js';
import subjectsScreen from './screens/subjects.js';
import subjectDetailScreen from './screens/subjectDetail.js';
import chatScreen from './screens/chat.js';
import flashcardsScreen from './screens/flashcards.js';
import flashcardStudyScreen from './screens/flashcardStudy.js';
import quizGenerateScreen from './screens/quizGenerate.js';
import quizTakeScreen from './screens/quizTake.js';
import quizResultScreen from './screens/quizResult.js';
import scanScreen from './screens/scan.js';
import progressScreen from './screens/progress.js';
import profileScreen from './screens/profile.js';
import proScreen from './screens/pro.js';
import createSubjectScreen from './screens/createSubject.js';

const SCREENS = {
  onboarding: onboardingScreen,
  login: loginScreen,
  signup: signupScreen,
  forgot: forgotScreen,
  home: homeScreen,
  subjects: subjectsScreen,
  subject: subjectDetailScreen,
  chat: chatScreen,
  flashcards: flashcardsScreen,
  flashcardStudy: flashcardStudyScreen,
  quizGenerate: quizGenerateScreen,
  quizTake: quizTakeScreen,
  quizResult: quizResultScreen,
  scan: scanScreen,
  progress: progressScreen,
  profile: profileScreen,
  pro: proScreen,
  createSubject: createSubjectScreen,
};

const NAV_TABS = ['home', 'subjects', 'chat', 'progress', 'profile'];

const appEl = document.getElementById('app');
const navEl = document.getElementById('bottom-nav');

// ---- lightweight hash router with params: #/route?k=v&k=v ----
let current = { route: null, params: {} };

function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = h.split('?');
  const params = {};
  new URLSearchParams(query).forEach((v, k) => { params[k] = v; });
  return { route: path || (isAuthed() ? 'home' : 'onboarding'), params };
}

async function render() {
  const { route, params } = parseHash();
  current = { route, params };

  const authed = isAuthed();

  // Auth guard: these routes need a session.
  const needsAuth = ['home', 'subjects', 'subject', 'chat', 'flashcards', 'flashcardStudy',
    'quizGenerate', 'quizTake', 'quizResult', 'scan', 'progress', 'profile', 'pro', 'createSubject'];
  if (needsAuth.includes(route) && !authed) {
    location.hash = '#/login';
    return;
  }
  // Authed users skip onboarding/auth.
  if ((route === 'onboarding' || route === 'login' || route === 'signup' || route === 'forgot') && authed) {
    location.hash = '#/home';
    return;
  }

  const screen = SCREENS[route] || (authed ? homeScreen : onboardingScreen);
  navEl.classList.toggle('hidden', !NAV_TABS.includes(route) || !authed);
  setActiveNav(route);

  appEl.innerHTML = '';
  try {
    await screen(appEl, params, app);
  } catch (e) {
    console.error(e);
    appEl.innerHTML = `<div class="loading-block">Something went wrong. <button class="btn btn-secondary mt8" onclick="location.reload()">Reload</button></div>`;
  }
  window.scrollTo(0, 0);
}

function setActiveNav(route) {
  navEl.querySelectorAll('.nav-item').forEach((b) => {
    b.classList.toggle('active', b.dataset.route === route);
  });
}

navEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.nav-item');
  if (!btn) return;
  location.hash = `#/${btn.dataset.route}`;
});

// Session expiry from api.js.
window.addEventListener('auth:expired', () => {
  toast('Session expired. Please log in again.', 'info');
  location.hash = '#/login';
});

// Server API base (shown in Profile > About, useful when AI not configured).
export const app = {
  get API() { return API; },
  user() { return getUser(); },
  refreshUser(u) { setUser(u); },
  navigate(route, params = {}) {
    const q = new URLSearchParams(params).toString();
    location.hash = `#/${route}${q ? '?' + q : ''}`;
  },
  get current() { return current; },
};

// Observe nav visibility when screens change sizes.
window.addEventListener('resize', () => { /* mobile safe-area handled by CSS */ });

// Load once DOM ready.
window.addEventListener('hashchange', render);
render();
