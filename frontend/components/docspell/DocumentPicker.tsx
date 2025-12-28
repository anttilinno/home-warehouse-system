'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { X, Search, FileText, Calendar, Tag, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { docspellApi, DocspellDocument, DocspellSearchResult } from '@/lib/api';

interface DocumentPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (document: DocspellDocument, attachmentType: AttachmentType) => void;
  itemName?: string;
}

type AttachmentType = 'PHOTO' | 'MANUAL' | 'RECEIPT' | 'WARRANTY' | 'OTHER';

export function DocumentPicker({
  isOpen,
  onClose,
  onSelect,
  itemName,
}: DocumentPickerProps) {
  const t = useTranslations('docspell');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<DocspellSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<DocspellDocument | null>(null);
  const [attachmentType, setAttachmentType] = useState<AttachmentType>('OTHER');

  // Debounced search
  const searchDocuments = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await docspellApi.searchDocuments(query, 20, 0);
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      searchDocuments(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, searchDocuments]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setResults(null);
      setSelectedDoc(null);
      setAttachmentType('OTHER');
      setError(null);
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (selectedDoc) {
      onSelect(selectedDoc, attachmentType);
    }
  };

  if (!isOpen) return null;

  const attachmentTypes: { value: AttachmentType; label: string }[] = [
    { value: 'RECEIPT', label: t('attachmentTypes.receipt') },
    { value: 'MANUAL', label: t('attachmentTypes.manual') },
    { value: 'WARRANTY', label: t('attachmentTypes.warranty') },
    { value: 'PHOTO', label: t('attachmentTypes.photo') },
    { value: 'OTHER', label: t('attachmentTypes.other') },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className={cn(
          'relative z-10 w-full max-w-2xl max-h-[85vh] m-4',
          'bg-background border border-border rounded-lg shadow-xl',
          'flex flex-col overflow-hidden'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">{t('picker.title')}</h2>
            {itemName && (
              <p className="text-sm text-muted-foreground">
                {t('picker.linkingTo', { item: itemName })}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('picker.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-destructive">
              {error}
            </div>
          )}

          {!loading && !error && !results && (
            <div className="text-center py-8 text-muted-foreground">
              {t('picker.enterSearch')}
            </div>
          )}

          {!loading && !error && results && results.items.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {t('picker.noResults')}
            </div>
          )}

          {results && results.items.length > 0 && (
            <div className="space-y-2">
              {results.items.map((doc) => (
                <button
                  type="button"
                  key={doc.id}
                  onClick={() => setSelectedDoc(doc)}
                  className={cn(
                    'w-full p-3 rounded-lg border text-left transition-colors',
                    selectedDoc?.id === doc.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:bg-muted/50'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{doc.name}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                        {doc.date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {doc.date}
                          </span>
                        )}
                        {doc.correspondent && (
                          <span>{doc.correspondent}</span>
                        )}
                      </div>
                      {doc.tags && doc.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {doc.tags.slice(0, 5).map((tag, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted rounded text-xs"
                            >
                              <Tag className="h-2.5 w-2.5" />
                              {tag}
                            </span>
                          ))}
                          {doc.tags.length > 5 && (
                            <span className="text-xs text-muted-foreground">
                              +{doc.tags.length - 5}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Attachment Type Selection */}
        {selectedDoc && (
          <div className="p-4 border-t bg-muted/30">
            <label className="block text-sm font-medium mb-2">
              {t('picker.attachmentType')}
            </label>
            <div className="flex flex-wrap gap-2">
              {attachmentTypes.map((type) => (
                <button
                  type="button"
                  key={type.value}
                  onClick={() => setAttachmentType(type.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm border transition-colors',
                    attachmentType === type.value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border hover:bg-muted'
                  )}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors"
          >
            {t('picker.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedDoc}
            className={cn(
              'px-4 py-2 rounded-md transition-colors',
              selectedDoc
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            {t('picker.link')}
          </button>
        </div>
      </div>
    </div>
  );
}
