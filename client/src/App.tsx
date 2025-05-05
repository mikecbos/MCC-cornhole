import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import Admin from "@/pages/admin";
import AuthPage from "@/pages/auth-page";
import NotFound from "@/pages/not-found";

// Create a protected route component
const ProtectedRoute = ({ component: Component, ...rest }: any) => {
  const [, setLocation] = useLocation();
  
  // Check if user is authenticated
  const isAdmin = localStorage.getItem("isAdmin") === "true";
  
  if (!isAdmin) {
    // Redirect to login page if not authenticated
    setLocation("/auth");
    return null;
  }
  
  return <Component {...rest} />;
};

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/admin">
        {(params) => <ProtectedRoute component={Admin} params={params} />}
      </Route>
      <Route path="/history">
        {() => <ProtectedRoute component={() => import("./pages/tournament-history").then(m => m.default)} />}
      </Route>
      <Route path="/tournaments/:id">
        {(params) => <ProtectedRoute component={() => import("./pages/tournament-details").then(m => m.default)} params={params} />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
