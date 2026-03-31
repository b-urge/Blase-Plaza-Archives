import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "./components/Layout";
import Home from "./pages/Home";
import MapView from "./pages/Map";
import ListView from "./pages/List";
import Report from "./pages/Report";
import About from "./pages/About";
import ApiAccess from "./pages/ApiAccess";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/map" component={MapView} />
        <Route path="/list" component={ListView} />
        <Route path="/report/:id" component={Report} />
        <Route path="/about" component={About} />
        <Route path="/api-access" component={ApiAccess} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
