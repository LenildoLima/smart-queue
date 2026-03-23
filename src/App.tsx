import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import RecuperarSenha from "./pages/RecuperarSenha";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import ComingSoon from "./pages/ComingSoon";
import Admin from "./pages/Admin";
import Perfil from "./pages/Perfil";
import NotFound from "./pages/NotFound";
import Display from "./pages/Display";

import Agendar from "./pages/Agendar";
import Relatorios from "./pages/Relatorios";
import Unidades from "./pages/Unidades";
import Fila from "./pages/Fila";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro" element={<Cadastro />} />
            <Route path="/recuperar-senha" element={<RecuperarSenha />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/agendar" element={<ProtectedRoute><Agendar /></ProtectedRoute>} />
            <Route path="/fila" element={<ProtectedRoute><Fila /></ProtectedRoute>} />
            <Route path="/perfil" element={<ProtectedRoute skipLayout><Perfil /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute skipLayout><Admin /></ProtectedRoute>} />
            <Route path="/unidades" element={<ProtectedRoute skipLayout><Unidades /></ProtectedRoute>} />
            <Route path="/relatorios" element={<ProtectedRoute skipLayout><Relatorios /></ProtectedRoute>} />
            <Route path="/display" element={<Display />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
