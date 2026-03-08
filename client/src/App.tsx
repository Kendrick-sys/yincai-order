import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

// 非首屏页面懒加载，减少首屏 JS 体积
const OrderForm      = lazy(() => import("./pages/OrderForm"));
const PrintPreview   = lazy(() => import("./pages/PrintPreview"));
const Customers      = lazy(() => import("./pages/Customers"));
const Trash          = lazy(() => import("./pages/Trash"));
const OrderView      = lazy(() => import("./pages/OrderView"));
const Settings       = lazy(() => import("./pages/Settings"));
const NotFound       = lazy(() => import("./pages/NotFound"));
const Login          = lazy(() => import("./pages/Login"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));

// 通用加载占位（轻量，避免布局抖动）
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">加载中...</p>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/order/new"} component={OrderForm} />
        <Route path={"/order/:id/edit"} component={OrderForm} />
        <Route path={"/order/:id/view"} component={OrderView} />
        <Route path={"/order/:id/print"} component={PrintPreview} />
        <Route path={"/customers"} component={Customers} />
        <Route path={"/trash"} component={Trash} />
        <Route path={"/settings"} component={Settings} />
        <Route path={"/404"} component={NotFound} />
        <Route path={"/login"} component={Login} />
        <Route path={"/admin/users"} component={UserManagement} />
        <Route path={"/change-password"} component={ChangePassword} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="top-right" richColors />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
