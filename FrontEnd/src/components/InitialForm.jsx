import { useState, useEffect } from "react";
import { Input } from './formQuizInputs/QuizInput';
import { Select } from "./formQuizInputs/QuizSelect";
import { motion } from "framer-motion";
import {
  Calculator,
  GraduationCap,
  BookOpen,
  Gamepad,
  Layers,
  Play,
  Sparkles,
} from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import toast from "react-hot-toast";
import AIQuestionGenerator from "./AIQuestionGenerator";


function InitialForm({ onDataChange, onGoToPreview, onGoToLevelForm }) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    course: "",
    topic: "",
    gameNumber: "",
    numLevels: "2",
    levels: [],
  });

  // Control AI Question Generator visibility
  const [showAIGenerator, setShowAIGenerator] = useState(false);

  useEffect(() => {
    // Clear form data when component mounts
    localStorage.removeItem("quizFormData");
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const newData = { ...formData, [name]: value };
    setFormData(newData);
    onDataChange(newData);
  };

  // ==============================
  //  Build initial empty levels
  // ==============================
  const buildEmptyLevels = (numLevels) =>
    Array(numLevels)
      .fill()
      .map((_, index) => ({
        level_number: index + 1,
        level_type: "box",
        level_stats: {
          coins: 0,
          lifes: 5,
          mistakes: 0,
          stars: 1,
          time_spent: 0,
        },
        questions: [],
      }));

  // ==============================
  //  "Start Creating" → go to LevelForm step (in App.jsx)
  // ==============================
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.course.trim() || !formData.topic.trim() || !formData.gameNumber.trim()) {
      toast.error(t("fill_all_fields") || "Please fill all fields");
      return;
    }

    if (!formData.numLevels) {
      toast.error(t("select_number_of_levels") || "Please select the number of levels");
      return;
    }

    // Close AI panel if open
    setShowAIGenerator(false);

    // Build levels structure
    const numLevels = parseInt(formData.numLevels, 10);
    const newLevels = buildEmptyLevels(numLevels);

    const updatedData = {
      ...formData,
      levels: newLevels,
      player_info: { current_level: 1, lives: 3, score: 0 },
    };

    setFormData(updatedData);
    onDataChange(updatedData);

    // Hand off to App-level step 2 (LevelForm page)
    onGoToLevelForm(updatedData);
  };


  //  ============================== AI Questions Handler ================================
  const handleAIQuestionsGenerated = (generatedData) => {
    // generatedData format (BULK mode):
    // { course: "...", topic: "...", gameNumber: 1, numLevels: 2, levels: [...], player_info: {...} }
    console.log("🤖 [InitialForm] Received Bulk AI-generated questions:", generatedData);

    try {
      setFormData(generatedData);
      onDataChange(generatedData);
      toast.success("All levels generated successfully!");

      // Auto-transition to preview
      onGoToPreview();

    } catch (error) {
      console.error("❌ [InitialForm] Error processing generated questions:", error);
      toast.error("Error applying generated questions");
    }
  };

  //  ============================== AI Button Handler ================================
  function handleAiButton() {
    if (!formData.numLevels) {
      toast.error(t("select_number_of_levels") || "Please select the number of levels");
      return;
    }

    // Create levels if they don't exist
    if (formData.levels.length === 0) {
      const numLevels = parseInt(formData.numLevels, 10);
      const newLevels = buildEmptyLevels(numLevels);

      const updatedData = {
        ...formData,
        levels: newLevels,
        player_info: { current_level: 1, lives: 3, score: 0 },
      };

      setFormData(updatedData);
      onDataChange(updatedData);
    }

    // Open AI generator panel
    setShowAIGenerator(true);
  }

  const numLevels = parseInt(formData.numLevels || 2, 10);

  return (
    <div className="w-full min-h-screen flex items-center justify-center py-8">
      <div
        className={`flex gap-8 w-full mx-auto px-4 transition-all duration-500 items-start ${showAIGenerator ? "max-w-[1400px]" : "max-w-2xl"
          }`}
      >
        {/* ===== LEFT SIDE: INITIAL FORM ===== */}
        <motion.div
          className={`glass-card p-8 transition-all duration-500  ${showAIGenerator ? "w-[420px] flex-shrink-0" : "flex-1"
            }`}
          initial={{ scale: 0.95, opacity: 0, x: -20 }}
          animate={{ scale: 1, opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="text-center mb-8">
            <div className="flex justify-center items-center gap-3 mb-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-purple-deep to-purple-main flex items-center justify-center shadow-lg shadow-purple-deep/20 hover-glow">
                <Calculator className="text-3xl text-white" />
              </div>
              <h2 className="text-3xl font-bold gradient-text">
                {t("create_math_quiz")}
              </h2>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              {t("design_interactive_quizzes")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              name="course"
              label={t("course_name")}
              value={formData.course}
              onChange={handleInputChange}
              placeholder={t("e.g., algebra_geometry")}
              icon={BookOpen}
            />

            <Input
              name="topic"
              label={t("topic")}
              value={formData.topic}
              onChange={handleInputChange}
              placeholder={t("e.g., quadratic_equations")}
              icon={GraduationCap}
            />

            <Input
              name="gameNumber"
              label={t("game_number")}
              value={formData.gameNumber}
              onChange={handleInputChange}
              placeholder={t("enter_game_number")}
              icon={Gamepad}
            />

            <Select
              name="numLevels"
              label={t("number_of_levels")}
              value={formData.numLevels}
              onChange={handleInputChange}
              icon={Layers}
              levels={[1, 2, 3, 4, 5, 6]}
            />

            {/* ===== ACTION BUTTONS ===== */}
            <div className="flex flex-col gap-3 pt-4">
              <motion.button
                type="submit"
                className="btn-primary flex items-center justify-center gap-2 w-full"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Play size={18} />
                {t("start_creating")}
              </motion.button>

              <motion.button
                type="button"
                onClick={handleAiButton}
                className="btn-secondary flex items-center justify-center gap-2 w-full"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Sparkles size={18} />
                {t("generate_quiz_with_ai")}
              </motion.button>
            </div>
          </form>
        </motion.div>

        {/* ===== RIGHT SIDE: AI GENERATOR PANEL ===== */}
        {showAIGenerator && (
          <motion.div
            className="w-[420px] flex-shrink-0 "
            initial={{ scale: 0.95, opacity: 0, x: 20 }}
            animate={{ scale: 1, opacity: 1, x: 0 }}
            exit={{ scale: 0.95, opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            <AIQuestionGenerator
              isOpen={true}
              onClose={() => setShowAIGenerator(false)}
              numLevels={numLevels}
              quizData={formData}
              onQuestionsGenerated={handleAIQuestionsGenerated}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default InitialForm;
