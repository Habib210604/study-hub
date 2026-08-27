'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';

const translations: Record<string, Record<string, string>> = {
  en: {
    // Header / greeting
    overview: 'Overview',
    welcomeBack: 'Welcome back to your study hub',
    goodMorning: 'Good morning',
    goodAfternoon: 'Good afternoon',
    goodEvening: 'Good evening',
    readyToFocus: "Let's make today count.",
    active: 'Active',
    logout: 'Logout',
    quickSearch: 'Quick search',
    commandPlaceholder: 'Jump to...',
    noResults: 'No matches.',
    cancel: 'Cancel',
    checkingSession: 'Checking session...',

    // Announcement / quote
    announcement: 'Announcement',
    examToday: 'Exam today!',

    // Overview bento widgets
    focusFlow: 'Focus & Flow',
    quickStats: 'Quick Stats',
    activeSubject: 'Active Subject',
    noActiveSubject: 'No active subject yet — add one in Subjects.',
    resume: 'Resume',
    todaysRoadmap: "Today's Roadmap",
    nothingScheduled: 'Nothing scheduled — enjoy the clear day.',
    today: 'Today',
    quickDrop: 'Resource Quick-Drop',
    noFilesYetShort: 'No files uploaded yet.',
    browseAll: 'Browse Subjects',
    openTimer: 'Open full timer',

    // Focus / Pomodoro
    pomodoroTimer: 'Focus Timer',
    focusSession: 'Focus Session',
    shortBreak: 'Short Break',
    startFocus: 'Start Focus',
    pauseTimer: 'Pause Timer',
    stayFocused: 'Stay focused on your task.',
    takeABreather: 'Take a breather and relax.',
    focusMinutes: 'Focus (min)',
    breakMinutes: 'Break (min)',
    todayFocus: "Today's Focus",

    // Goals
    dailyGoals: 'Daily Goals',
    addGoalPlaceholder: 'Add a new goal...',
    loadingGoals: 'Loading goals...',
    noGoals: 'No goals added yet.',
    tasksDone: 'Tasks Done',

    // Calendar
    calendarEvents: 'Calendar & Events',
    holidaysHighlight: 'Official Tunisian holidays highlighted in',
    moodHint: 'Click the dot on any day to log your mood',
    eventTitlePlaceholder: 'Event or Exam Title...',
    addEvent: 'Add Event',
    howFeeling: 'How are you feeling?',
    setMood: 'Set mood',
    sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat',

    // Notes
    quickNotes: 'Quick Notes & Scratchpad',
    scratchpadPlaceholder: 'Jot down quick thoughts, reminders, or things to look up later...',
    saving: 'Saving...',
    saved: 'Saved ✓',

    // Subjects / Drive
    subjectFolders: 'Subjects',
    subjectFoldersDrive: 'Subjects & Resource Vault',
    folderClickPrompt: 'Click any subject to open it and manage notes, exercises, and PDFs.',
    folderPlaceholder: 'Subject name (e.g. Mathematics, Architecture)...',
    addFolder: 'Add',
    searchFolders: 'Search subjects...',
    loadingFolders: 'Loading subjects...',
    noFolders: 'No subjects created yet.',
    noFoldersMatch: 'No subjects match your search.',
    mastered: 'Mastered',
    inProgress: 'In Progress',
    openFolder: 'Open',
    foldersCount: 'Folders',
    folderDriveFiles: 'Manage files, PDFs, and resources for this subject',
    filesUploaded: 'files uploaded in this folder',
    uploadFile: 'Upload File',
    uploading: 'Uploading...',
    noFilesYet: 'No files uploaded to this folder yet.',

    // Flashcards
    aiFlashcards: 'Flashcards',

    // Assistant
    assistantHint: 'Your study assistant floats in the corner of every page — click the chat bubble to open it anytime.',

    // Misc / dashboard title
    dashboardWorkspace: 'Dashboard Workspace',
  },
  fr: {
    // Header / greeting
    overview: 'Aperçu',
    welcomeBack: 'Bon retour sur votre espace d\u2019étude',
    goodMorning: 'Bonjour',
    goodAfternoon: 'Bon après-midi',
    goodEvening: 'Bonsoir',
    readyToFocus: 'Faisons que cette journée compte.',
    active: 'Actif',
    logout: 'Déconnexion',
    quickSearch: 'Recherche rapide',
    commandPlaceholder: 'Aller à...',
    noResults: 'Aucun résultat.',
    cancel: 'Annuler',
    checkingSession: 'Vérification de la session...',

    // Announcement / quote
    announcement: 'Annonce',
    examToday: 'Examen aujourd\u2019hui !',

    // Overview bento widgets
    focusFlow: 'Concentration',
    quickStats: 'Statistiques Rapides',
    activeSubject: 'Matière Active',
    noActiveSubject: 'Aucune matière active — ajoutez-en une dans Matières.',
    resume: 'Reprendre',
    todaysRoadmap: 'Programme du Jour',
    nothingScheduled: 'Rien de prévu — profitez de cette journée libre.',
    today: 'Aujourd\u2019hui',
    quickDrop: 'Ressources Récentes',
    noFilesYetShort: 'Aucun fichier importé pour le moment.',
    browseAll: 'Voir les Matières',
    openTimer: 'Ouvrir le minuteur',

    // Focus / Pomodoro
    pomodoroTimer: 'Minuteur',
    focusSession: 'Session de Concentration',
    shortBreak: 'Courte Pause',
    startFocus: 'Commencer',
    pauseTimer: 'Mettre en Pause',
    stayFocused: 'Restez concentré sur votre tâche.',
    takeABreather: 'Prenez une pause et détendez-vous.',
    focusMinutes: 'Concentration (min)',
    breakMinutes: 'Pause (min)',
    todayFocus: 'Focus du Jour',

    // Goals
    dailyGoals: 'Objectifs Quotidiens',
    addGoalPlaceholder: 'Ajouter un nouvel objectif...',
    loadingGoals: 'Chargement des objectifs...',
    noGoals: 'Aucun objectif ajouté pour le moment.',
    tasksDone: 'Tâches Terminées',

    // Calendar
    calendarEvents: 'Calendrier & Événements',
    holidaysHighlight: 'Jours fériés tunisiens officiels surlignés en',
    moodHint: 'Cliquez sur le point d\u2019un jour pour noter votre humeur',
    eventTitlePlaceholder: 'Titre de l\u2019événement ou de l\u2019examen...',
    addEvent: 'Ajouter un Événement',
    howFeeling: 'Comment vous sentez-vous ?',
    setMood: 'Définir l\u2019humeur',
    sun: 'Dim', mon: 'Lun', tue: 'Mar', wed: 'Mer', thu: 'Jeu', fri: 'Ven', sat: 'Sam',

    // Notes
    quickNotes: 'Notes Rapides',
    scratchpadPlaceholder: 'Notez rapidement vos pensées, rappels, ou choses à vérifier plus tard...',
    saving: 'Enregistrement...',
    saved: 'Enregistré ✓',

    // Subjects / Drive
    subjectFolders: 'Matières',
    subjectFoldersDrive: 'Matières & Espace de Ressources',
    folderClickPrompt: 'Cliquez sur une matière pour l\u2019ouvrir et gérer notes, exercices et PDFs.',
    folderPlaceholder: 'Nom de la matière (ex : Mathématiques, Architecture)...',
    addFolder: 'Ajouter',
    searchFolders: 'Rechercher une matière...',
    loadingFolders: 'Chargement des matières...',
    noFolders: 'Aucune matière créée pour le moment.',
    noFoldersMatch: 'Aucune matière ne correspond à votre recherche.',
    mastered: 'Maîtrisé',
    inProgress: 'En Cours',
    openFolder: 'Ouvrir',
    foldersCount: 'Dossiers',
    folderDriveFiles: 'Gérez les fichiers, PDFs et ressources de cette matière',
    filesUploaded: 'fichier(s) importé(s) dans ce dossier',
    uploadFile: 'Importer un Fichier',
    uploading: 'Importation...',
    noFilesYet: 'Aucun fichier importé dans ce dossier pour le moment.',

    // Flashcards
    aiFlashcards: 'Flashcards',

    // Assistant
    assistantHint: 'Votre assistant d\u2019étude flotte dans le coin de chaque page — cliquez sur la bulle de discussion pour l\u2019ouvrir à tout moment.',

    // Misc / dashboard title
    dashboardWorkspace: 'Espace Tableau de Bord',
  },
};

interface LanguageContextType {
  language: string;
  setLanguage: (lang: string) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguageState] = useState('en');

  useEffect(() => {
    const savedLang = localStorage.getItem('app_language') || 'en';
    setLanguageState(savedLang);
  }, []);

  const setLanguage = (lang: string) => {
    setLanguageState(lang);
    localStorage.setItem('app_language', lang);
  };

  const t = (key: string) => {
    return translations[language]?.[key] || translations['en']?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};