import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function CategoryRowSkeleton({ level = 0 }: { level?: number }) {
  return (
    <div
      className="flex items-center gap-2 py-2 px-3 rounded-lg"
      style={{ marginLeft: level * 24 }}
    >
      <Skeleton className="h-4 w-4" />
      <Skeleton className="h-4 w-4" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-[200px]" />
        <Skeleton className="h-3 w-[300px]" />
      </div>
      <Skeleton className="h-8 w-8" />
    </div>
  );
}

export function CategoryListSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-[150px]" />
        <Skeleton className="h-4 w-[200px]" />
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          <CategoryRowSkeleton level={0} />
          <CategoryRowSkeleton level={1} />
          <CategoryRowSkeleton level={1} />
          <CategoryRowSkeleton level={0} />
          <CategoryRowSkeleton level={1} />
          <CategoryRowSkeleton level={2} />
          <CategoryRowSkeleton level={0} />
        </div>
      </CardContent>
    </Card>
  );
}
