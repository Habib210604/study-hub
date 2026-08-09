'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';

const translations: Record<string, Record<string, string>> = {
  en: {
    dashboardWorkspace: 'Dashboard Workspace',
    welcomeBack: 'Welcome back to your study hub',
    focusSession: 'Focus Session',
    shortBreak: 'Short Break',
    startFocus: 'Start Focus',
    pauseTimer: 'Pause Timer',
    dailyGoals: 'Daily Goals',
    addGoalPlaceholder: 'Add a new goal...',
    calendarEvents: 'Calendar & Events',
    subjectFolders: 'Subject Folders & Drive',
    aiFlashcards: 'AI Flashcards',
    todayFocus: "Today's Focus",
    tasksDone: 'Tasks Done',
    foldersCount: 'Folders',
    uploadFile: 'Upload File',
  },
  fr: {
    dashboardWorkspace: 'Espace Tableau de Bord',
    welcomeBack: 'Bon retour sur votre espace d’étude',
    focusSession: 'Session de Concentration',
    shortBreak: 'Courte Pause',
    startFocus: 'Commencer',
    pauseTimer: 'Mettre en Pause',
    dailyGoals: 'Objectifs Quotidiens',
    addGoalPlaceholder: 'Ajouter un nouvel objectif...',
    calendarEvents: 'Calendrier & Événements',
    subjectFolders: 'Dossiers de Matières & Drive',
    aiFlashcards: 'Flashcards IA',
    todayFocus: "Focus du Jour",
    tasksDone: 'Tâches Terminées',
    foldersCount: 'Dossiers',
    uploadFile: 'Importer un Fichier',
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