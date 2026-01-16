# Pending Changes Integration Guide

This guide explains how to integrate pending change handling (approval workflow) into your forms and API calls.

## Overview

When members (non-admin users) create, update, or delete entities, their changes may require approval before being applied. The API returns:
- **202 Accepted**: Change is pending approval
- **201 Created / 200 OK**: Change was applied immediately

## Quick Start

### 1. Update Your Form to Handle 202 Responses

Use the `usePendingChangeHandler` hook and API methods with status codes:

```tsx
import { usePendingChangeHandler, PendingChangeBanner } from "@/lib/hooks/use-pending-change-handler";
import { apiClient, type ApiResponse } from "@/lib/api";

function CreateItemForm() {
  const [pendingChangeId, setPendingChangeId] = useState<string | undefined>();
  const { workspaceId } = useWorkspace();
  const router = useRouter();

  const { handleResponse } = usePendingChangeHandler({
    entityType: "item",
    action: "create",
    onSuccess: () => router.push("/dashboard/items"),
    successMessage: "Item created",
    successDescription: "Your item has been created successfully.",
  });

  const onSubmit = async (data: ItemCreateData) => {
    try {
      // Use postWithStatus to get status code
      const response: ApiResponse<Item> = await apiClient.postWithStatus(
        `/workspaces/${workspaceId}/items`,
        data,
        workspaceId
      );

      // Handle response based on status
      const result = handleResponse(response.data, response.status);

      if (result.isPending) {
        setPendingChangeId(result.pendingChangeId);
        // Optionally stay on the form page to show pending banner
      }
    } catch (error) {
      toast.error("Failed to create item");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Show banner if change is pending */}
      <PendingChangeBanner pendingChangeId={pendingChangeId} />

      {/* Your form fields */}
      <Button type="submit" disabled={!!pendingChangeId}>
        Create Item
      </Button>
    </form>
  );
}
```

### 2. For Update Operations

```tsx
const { handleResponse } = usePendingChangeHandler({
  entityType: "item",
  action: "update",
  onSuccess: () => router.push(`/dashboard/items/${itemId}`),
  successMessage: "Item updated",
  successDescription: "Your changes have been saved.",
});

const onSubmit = async (data: ItemUpdateData) => {
  const response = await apiClient.patchWithStatus(
    `/workspaces/${workspaceId}/items/${itemId}`,
    data,
    workspaceId
  );

  handleResponse(response.data, response.status);
};
```

### 3. For Delete Operations

```tsx
const { handleResponse } = usePendingChangeHandler({
  entityType: "item",
  action: "delete",
  onSuccess: () => router.push("/dashboard/items"),
  successMessage: "Item deleted",
  successDescription: "The item has been deleted.",
});

const handleDelete = async () => {
  const response = await apiClient.deleteWithStatus(
    `/workspaces/${workspaceId}/items/${itemId}`,
    workspaceId
  );

  handleResponse(response.data, response.status);
};
```

## API Client Methods

The API client provides two sets of methods:

### Standard Methods (without status code)
- `apiClient.get<T>(endpoint, workspaceId)`
- `apiClient.post<T>(endpoint, data, workspaceId)`
- `apiClient.patch<T>(endpoint, data, workspaceId)`
- `apiClient.delete(endpoint, workspaceId)`

### Methods with Status Code (for pending changes)
- `apiClient.postWithStatus<T>(endpoint, data, workspaceId)` → `ApiResponse<T>`
- `apiClient.patchWithStatus<T>(endpoint, data, workspaceId)` → `ApiResponse<T>`
- `apiClient.deleteWithStatus(endpoint, workspaceId)` → `ApiResponse<void>`

The `ApiResponse<T>` type includes:
```typescript
interface ApiResponse<T> {
  data: T;
  status: number;
}
```

## Pending Change Handler Hook

### Options

```typescript
interface UsePendingChangeHandlerOptions {
  entityType: string;           // "item", "location", "container", etc.
  action: "create" | "update" | "delete";
  onSuccess?: () => void;       // Called when change is immediately applied
  successMessage?: string;      // Toast title for immediate success
  successDescription?: string;  // Toast description for immediate success
}
```

### Return Value

```typescript
{
  handleResponse: (
    response: any,
    statusCode: number,
    customPendingMessage?: string
  ) => {
    isPending: boolean;
    pendingChangeId?: string;
  }
}
```

## Toast Messages

The hook automatically shows appropriate toast messages:

### For 202 (Pending)
- **Title**: "Change Pending Approval"
- **Description**: "Your {action} request for {entityType} is pending admin approval."
- **Action**: Button to navigate to "My Changes" page

### For 201/200 (Success)
- Uses your custom `successMessage` and `successDescription`

## Pending Change Banner

Show a banner after submission to indicate pending status:

```tsx
<PendingChangeBanner pendingChangeId={pendingChangeId} />
```

This displays:
- Info icon with yellow styling
- "Pending Approval" title
- Description explaining the change is awaiting approval
- Link to "View My Changes" page

## Complete Example

Here's a complete example integrating all features:

```tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { useWorkspace } from "@/lib/hooks/use-workspace";
import { usePendingChangeHandler, PendingChangeBanner } from "@/lib/hooks/use-pending-change-handler";
import { apiClient, type ApiResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ItemFormData {
  name: string;
  sku: string;
  category_id?: string;
}

export function CreateItemForm() {
  const router = useRouter();
  const { workspaceId } = useWorkspace();
  const [pendingChangeId, setPendingChangeId] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ItemFormData>();

  const { handleResponse } = usePendingChangeHandler({
    entityType: "item",
    action: "create",
    onSuccess: () => {
      // Only navigate away if change was immediately applied
      router.push("/dashboard/items");
    },
    successMessage: "Item created",
    successDescription: "Your new item has been added to the inventory.",
  });

  const onSubmit = async (data: ItemFormData) => {
    if (!workspaceId) return;

    try {
      setIsSubmitting(true);

      // Use postWithStatus to get the status code
      const response: ApiResponse<{ id: string; pending_change_id?: string }> =
        await apiClient.postWithStatus(
          `/workspaces/${workspaceId}/items`,
          data,
          workspaceId
        );

      // Handle the response based on status code
      const result = handleResponse(response.data, response.status);

      if (result.isPending) {
        // Change is pending - show banner and disable form
        setPendingChangeId(result.pendingChangeId);
      }
      // If not pending, onSuccess callback will handle navigation
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create item";
      toast.error("Error", { description: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Show pending banner if applicable */}
      {pendingChangeId && <PendingChangeBanner pendingChangeId={pendingChangeId} />}

      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Item Name</Label>
          <Input
            id="name"
            {...form.register("name", { required: true })}
            disabled={!!pendingChangeId}
          />
        </div>

        <div>
          <Label htmlFor="sku">SKU</Label>
          <Input
            id="sku"
            {...form.register("sku", { required: true })}
            disabled={!!pendingChangeId}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={isSubmitting || !!pendingChangeId}
        >
          {isSubmitting ? "Creating..." : "Create Item"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
```

## My Changes Page

Users can view their pending changes at `/dashboard/my-changes`. This page shows:
- All changes submitted by the current user
- Status: Pending, Approved, or Rejected
- Submission date and review information
- Rejection reasons if applicable

The sidebar automatically shows a badge with the count of pending changes.

## Best Practices

1. **Always use `*WithStatus` methods** for create/update/delete operations that may require approval
2. **Show the pending banner** when a change is pending to give clear feedback
3. **Disable form submission** while a change is pending to prevent duplicate submissions
4. **Provide navigation to My Changes** so users can track their pending requests
5. **Test with different user roles** (member vs admin) to ensure correct behavior
6. **Handle errors gracefully** and provide clear error messages

## Testing Checklist

- [ ] Member submits create - receives 202 and sees pending toast
- [ ] Member submits update - receives 202 and sees pending toast
- [ ] Member submits delete - receives 202 and sees pending toast
- [ ] Admin submits change - receives 201/200 and sees success toast
- [ ] Pending banner shows after 202 response
- [ ] Form is disabled after pending submission
- [ ] "My Changes" link in toast works
- [ ] "My Changes" page shows pending request
- [ ] Sidebar badge shows pending count
- [ ] Real-time updates via SSE work correctly
