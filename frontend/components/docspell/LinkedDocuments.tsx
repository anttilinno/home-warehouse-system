'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { FileText, ExternalLink, Trash2, Plus, Loader2, Calendar, Tag } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { docspellApi, ItemAttachment, DocspellDocument, DocspellSettings } from '@/lib/api';
import { DocumentPicker } from './DocumentPicker';
import { useToast } from '@/components/ui/use-toast';

interface LinkedDocumentsProps {
  itemId: string;
  itemName?: string;
  className?: string;
}

export function LinkedDocuments({ itemId, itemName, className }: LinkedDocumentsProps) {
  const t = useTranslations('docspell');
  const { toast } = useToast();
  const [attachments, setAttachments] = useState<ItemAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [linking, setLinking] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settings, setSettings] = useState<DocspellSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);

  // Check if Docspell is configured
  useEffect(() => {
    const checkSettings = async () => {
      try {
        const s = await docspellApi.getSettings();
        setSettings(s);
      } catch {
        setSettings(null);
      } finally {
        setSettingsLoading(false);
      }
    };
    checkSettings();
  }, []);

  // Load attachments
  const loadAttachments = useCallback(async () => {
    if (!settings?.is_enabled) return;

    setLoading(true);
    setError(null);
    try {
      const data = await docspellApi.getItemAttachments(itemId);
      setAttachments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [itemId, settings?.is_enabled]);

  useEffect(() => {
    if (settings?.is_enabled) {
      loadAttachments();
    } else {
      setLoading(false);
    }
  }, [loadAttachments, settings?.is_enabled]);

  const handleLinkDocument = async (
    document: DocspellDocument,
    attachmentType: 'PHOTO' | 'MANUAL' | 'RECEIPT' | 'WARRANTY' | 'OTHER'
  ) => {
    setLinking(true);
    try {
      const newAttachment = await docspellApi.linkDocument(itemId, {
        docspell_item_id: document.id,
        attachment_type: attachmentType,
        title: document.name,
      });
      setAttachments((prev) => [...prev, newAttachment]);
      setIsPickerOpen(false);
      toast({
        title: t('linkedDocuments.linkSuccess'),
        description: document.name,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link document');
      toast({
        title: t('linkedDocuments.linkError'),
        description: err instanceof Error ? err.message : 'Failed to link document',
        variant: 'destructive',
      });
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async (attachmentId: string) => {
    setDeletingId(attachmentId);
    try {
      await docspellApi.unlinkDocument(itemId, attachmentId);
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      toast({
        title: t('linkedDocuments.unlinkSuccess'),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlink document');
      toast({
        title: t('linkedDocuments.unlinkError'),
        description: err instanceof Error ? err.message : 'Failed to unlink document',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const getAttachmentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      RECEIPT: t('attachmentTypes.receipt'),
      MANUAL: t('attachmentTypes.manual'),
      WARRANTY: t('attachmentTypes.warranty'),
      PHOTO: t('attachmentTypes.photo'),
      OTHER: t('attachmentTypes.other'),
    };
    return labels[type] || type;
  };

  const getAttachmentTypeBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      RECEIPT: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      MANUAL: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      WARRANTY: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      PHOTO: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      OTHER: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
    };
    return colors[type] || colors.OTHER;
  };

  // Don't render if Docspell is not configured
  if (settingsLoading) {
    return (
      <div className={cn('p-4', className)}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!settings || !settings.is_enabled) {
    return null; // Don't show the section if Docspell is not configured
  }

  return (
    <div className={cn('', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {t('linkedDocuments.title')}
        </h3>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsPickerOpen(true);
          }}
          disabled={linking}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {linking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {t('linkedDocuments.addDocument')}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 mb-4 bg-destructive/10 text-destructive rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty State */}
      {!loading && attachments.length === 0 && (
        <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
          <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>{t('linkedDocuments.noDocuments')}</p>
          <p className="text-sm mt-1">{t('linkedDocuments.noDocumentsHint')}</p>
        </div>
      )}

      {/* Documents List */}
      {!loading && attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg border border-border"
            >
              <FileText className="h-5 w-5 mt-0.5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {attachment.title || attachment.docspell_document?.name || t('linkedDocuments.untitled')}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', getAttachmentTypeBadgeColor(attachment.attachment_type))}>
                        {getAttachmentTypeLabel(attachment.attachment_type)}
                      </span>
                      {attachment.docspell_document?.date && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {attachment.docspell_document.date}
                        </span>
                      )}
                    </div>
                    {attachment.docspell_document?.tags && attachment.docspell_document.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {attachment.docspell_document.tags.slice(0, 3).map((tag, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-muted rounded text-xs"
                          >
                            <Tag className="h-2.5 w-2.5" />
                            {tag}
                          </span>
                        ))}
                        {attachment.docspell_document.tags.length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{attachment.docspell_document.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {settings?.base_url && attachment.docspell_item_id && (
                      <a
                        href={`${settings.base_url}/app/item/${attachment.docspell_item_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        title={t('linkedDocuments.openInDocspell')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUnlink(attachment.id);
                      }}
                      disabled={deletingId === attachment.id}
                      className="p-1.5 rounded hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive disabled:opacity-50"
                      title={t('linkedDocuments.unlink')}
                    >
                      {deletingId === attachment.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Document Picker Modal */}
      <DocumentPicker
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={handleLinkDocument}
        itemName={itemName}
      />
    </div>
  );
}
