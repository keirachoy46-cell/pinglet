import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import FamilyDashboard from "./pages/family/FamilyDashboard";
import CreateElder from "./pages/family/CreateElder";
import CreateNotification from "./pages/family/CreateNotification";
import ElderInterface from "./pages/elder/ElderInterface";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/family" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/family" element={<ProtectedRoute><FamilyDashboard /></ProtectedRoute>} />
            <Route path="/family/create-elder" element={<ProtectedRoute><CreateElder /></ProtectedRoute>} />
            <Route path="/family/create-notification" element={<ProtectedRoute><CreateNotification /></ProtectedRoute>} />
            <Route path="/elder/:elderProfileId" element={<ElderInterface />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
