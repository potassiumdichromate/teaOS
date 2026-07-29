import { Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute.js";
import Landing from "@/pages/Landing.js";
import Login from "@/pages/Login.js";
import Verify from "@/pages/Verify.js";
import TeacherLayout from "@/pages/teacher/TeacherLayout.js";
import TeacherDashboard from "@/pages/teacher/TeacherDashboard.js";
import SubmitQuestion from "@/pages/teacher/SubmitQuestion.js";
import QuestionHistory from "@/pages/teacher/QuestionHistory.js";
import AdminLayout from "@/pages/admin/AdminLayout.js";
import AdminOverview from "@/pages/admin/AdminOverview.js";
import BlueprintGenerator from "@/pages/admin/BlueprintGenerator.js";
import PaperGeneration from "@/pages/admin/PaperGeneration.js";
import EvaluationAIR from "@/pages/admin/EvaluationAIR.js";
import ComputeDashboard from "@/pages/admin/ComputeDashboard.js";
import StorageExplorer from "@/pages/admin/StorageExplorer.js";
import CenterHome from "@/pages/center/CenterHome.js";
import StudentExamClient from "@/pages/student/StudentExamClient.js";
import ObserverHome from "@/pages/observer/ObserverHome.js";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/verify" element={<Verify />} />

      <Route
        path="/teacher"
        element={
          <ProtectedRoute role="TEACHER">
            <TeacherLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<TeacherDashboard />} />
        <Route path="submit" element={<SubmitQuestion />} />
        <Route path="history" element={<QuestionHistory />} />
      </Route>

      <Route
        path="/admin"
        element={
          <ProtectedRoute role="ADMIN">
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminOverview />} />
        <Route path="blueprints" element={<BlueprintGenerator />} />
        <Route path="papers" element={<PaperGeneration />} />
        <Route path="evaluation" element={<EvaluationAIR />} />
        <Route path="compute" element={<ComputeDashboard />} />
        <Route path="storage" element={<StorageExplorer />} />
      </Route>
      <Route
        path="/center/*"
        element={
          <ProtectedRoute role="CENTER">
            <CenterHome />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/*"
        element={
          <ProtectedRoute role="STUDENT">
            <StudentExamClient />
          </ProtectedRoute>
        }
      />
      <Route
        path="/observer/*"
        element={
          <ProtectedRoute role="OBSERVER">
            <ObserverHome />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
