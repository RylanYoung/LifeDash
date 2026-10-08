import { StoreProvider } from "@/lib/store";
import { Shell } from "@/components/Shell";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <StoreProvider>
      <Shell>{children}</Shell>
    </StoreProvider>
  );
}
