import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import OrderForm from "./pages/OrderForm";
import PrintPreview from "./pages/PrintPreview";
import Customers from "./pages/Customers";
import Trash from "./pages/Trash";
import OrderView from "./pages/OrderView";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/order/new"} component={OrderForm} />
      <Route path={"/order/:id/edit"} component={OrderForm} />
      <Route path={"/order/:id/view"} component={OrderView} />
      <Route path={"/order/:id/print"} component={PrintPreview} />
      <Route path={"/customers"} component={Customers} />
      <Route path={"/trash"} component={Trash} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
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
