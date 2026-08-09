'use client';

import React, { useState } from 'react';

interface Resource {
  id: string;
  title: string;
  category: 'Lecture Notes' | 'Exam Papers' | 'Summary Sheets';
  author: string;
  date: string;
  downloads: number;
  fileSize: string;
}

const INITIAL_RESOURCES: Resource[] = [
  {
    id: '1',
    title: 'Anatomy Midterm Exam Archive',
    category: 'Exam Papers',
    author: 'Student Union',
    date: '2026-04-12',
    downloads: 142,
    fileSize: '4.2 MB',
  },
  {
    id: '2',
    title: 'Complete Semester Summary',
    category: 'Summary Sheets',
    author: 'Class Rep',
    date: '2026-05-01',
    downloads: 98,
    fileSize: '2.8 MB',
  },
];

export default function ResourceRepository() {
  const [resources, setResources] = useState<Resource[]>(INITIAL_RESOURCES);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'Lecture Notes' | 'Exam Papers' | 'Summary Sheets'>('Lecture Notes');

  const filteredResources = resources.filter((res) => {
    const matchesCategory = selectedCategory === 'All' || res.category === selectedCategory;
    const matchesSearch = res.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newRes: Resource = {
      id: Date.now().toString(),
      title: newTitle,
      category: newCategory,
      author: 'You',
      date: new Date().toISOString().split('T')[0],
      downloads: 0,
      fileSize: '1.5 MB',
    };

    setResources([newRes, ...resources]);
    setNewTitle('');
    setIsUploading(false);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">📂 Repository</h2>
          <p className="text-sm text-zinc-500">Share and download lecture notes and past exams.</p>
        </div>
        <button
          onClick={() => setIsUploading(!isUploading)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl shadow-md"
        >
          {isUploading ? 'Cancel' : 'Upload 📤'}
        </button>
      </div>

      {isUploading && (
        <form onSubmit={handleUpload} className="mb-6 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl space-y-4">
          <input
            type="text"
            placeholder="Resource Title..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full p-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 text-sm"
            required
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as any)}
            className="w-full p-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 text-sm"
          >
            <option value="Lecture Notes">Lecture Notes</option>
            <option value="Exam Papers">Exam Papers</option>
            <option value="Summary Sheets">Summary Sheets</option>
          </select>
          <button type="submit" className="w-full py-2.5 bg-emerald-600 text-white rounded-lg text-sm">
            Publish ✨
          </button>
        </form>
      )}

      <input
        type="text"
        placeholder="Search resources..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full p-3 mb-4 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
      />

      <div className="space-y-3">
        {filteredResources.map((res) => (
          <div key={res.id} className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40">
            <div>
              <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400">{res.category}</span>
              <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{res.title}</h4>
            </div>
            <button onClick={() => alert(`Downloading "${res.title}"`)} className="px-3 py-1.5 bg-zinc-200 dark:bg-zinc-700 text-xs rounded-lg">
              Download 📥
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}