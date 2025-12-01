import React, { useState, useEffect, useRef, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  getDatabase,
  ref,
  onValue,
  update,
  push,
  serverTimestamp,
} from "firebase/database";
import {
  Search,
  Camera,
  Trash2,
  ShieldCheck,
  LogOut,
  User,
  ImageOff,
  CheckCircle2,
  X,
  RefreshCw,
  Grid3X3,
  List,
  Clock,
  Database,
  Shield,
  Activity,
  BarChart3,
  SortAsc,
  SortDesc,
  UserPlus,
  Lock,
  Unlock,
  AlertTriangle,
  History,
  FlipHorizontal,
  ChevronRight,
  Filter,
  FileText,
  Check,
  XCircle,
} from "lucide-react";

// --- Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyAc2g-t9A7du3K_nI2fJnw_OGxhmLfpP6s",
  authDomain: "dilistname.firebaseapp.com",
  databaseURL: "https://dilistname-default-rtdb.firebaseio.com",
  projectId: "dilistname",
  storageBucket: "dilistname.firebasestorage.app",
  messagingSenderId: "897983357871",
  appId: "1:897983357871:web:42a046bc9fb3e0543dc55a",
  measurementId: "G-NQ798D9J6K",
};

const CLOUDINARY_URL = "https://api.cloudinary.com/v1_1/dttx1x743/image/upload";
const CLOUDINARY_PRESET = "difulllist";
const ALLOWED_ADMIN_IDS = ["250", "246", "249", "247", "273", "169"];

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// --- Main App Component ---
export default function App() {
  // Global State
  const [currentUser, setCurrentUser] = useState(null);
  const [adminProfile, setAdminProfile] = useState(null);
  const [allStudents, setAllStudents] = useState([]);
  const [adminLogs, setAdminLogs] = useState([]);
  const [allAdminLogs, setAllAdminLogs] = useState([]);
  const [adminList, setAdminList] = useState([]);
  const [capturedCount, setCapturedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // UI State
  const [activeTab, setActiveTab] = useState("home");
  const [searchQuery, setSearchQuery] = useState("");
  const [displayLimit, setDisplayLimit] = useState(20);

  // Feature States
  const [cameraState, setCameraState] = useState({
    isOpen: false,
    studentId: null,
    studentName: null,
  });
  const [previewState, setPreviewState] = useState({
    isOpen: false,
    blob: null,
    isUploading: false,
  });

  // Custom Modal States
  const [alertState, setAlertState] = useState({
    isOpen: false,
    message: "",
    type: "success",
  });
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
  });
  const [addAdminState, setAddAdminState] = useState({
    isOpen: false,
    adminId: "",
    adminName: "",
  });
  const [selectedAdminDetails, setSelectedAdminDetails] = useState(null);

  // Policy & Welcome States
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Delete tab specific states
  const [deleteViewMode, setDeleteViewMode] = useState("grid");
  const [selectedImages, setSelectedImages] = useState(new Set());
  const [showBatchActions, setShowBatchActions] = useState(false);

  // --- Effects ---
  useEffect(() => {
    // Note: We don't auto-load adminProfile from localStorage here to ensure
    // the policy popup shows on fresh login if desired.
    // However, for UX, if you want persistence, keep it.
    // If you want Policy to show EVERY time they open the page, comment this out.
    const savedAdmin = localStorage.getItem("adminData");
    if (savedAdmin) setAdminProfile(JSON.parse(savedAdmin));

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) signInAnonymously(auth);
    });

    const studentsRef = ref(db, "students");
    const unsubData = onValue(studentsRef, (snapshot) => {
      setLoading(true);
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([key, val]) => ({
          id: key,
          ...val,
        }));
        list.sort((a, b) => (parseInt(a.id) || 0) - (parseInt(b.id) || 0));
        setAllStudents(list);

        const captured = list.filter(
          (s) => s["រូបថត"] && s["រូបថត"] !== "n/a" && s["រូបថត"] !== ""
        ).length;
        setCapturedCount(captured);

        const admins = ALLOWED_ADMIN_IDS.map((id) => {
          const student = list.find((s) => s.id === id);
          return {
            id: id,
            name: student ? student["ឈ្មោះ"] : `Admin ${id}`,
            isBlocked: student ? student.isBlocked || false : false,
          };
        });
        setAdminList(admins);
      } else {
        setAllStudents([]);
        setCapturedCount(0);
        setAdminList([]);
      }
      setLoading(false);
    });

    return () => {
      unsubAuth();
      unsubData();
    };
  }, []);

  // Effect to fetch admin logs
  useEffect(() => {
    if (!adminProfile) return;
    const adminLogsRef = ref(db, `admin_logs/${adminProfile.id}`);
    const unsubLogs = onValue(adminLogsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const logs = Object.entries(data).map(([key, val]) => ({
          id: key,
          ...val,
        }));
        logs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setAdminLogs(logs);
      } else {
        setAdminLogs([]);
      }
    });
    return () => unsubLogs();
  }, [adminProfile]);

  // Effect for SuperAdmin logs
  useEffect(() => {
    if (!adminProfile || adminProfile.id !== "250") return;
    const allLogsRef = ref(db, "admin_logs");
    const unsubAllLogs = onValue(allLogsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const allLogs = [];
        Object.entries(data).forEach(([adminId, logs]) => {
          if (logs) {
            Object.entries(logs).forEach(([logId, log]) => {
              allLogs.push({ adminId, ...log, id: logId });
            });
          }
        });
        setAllAdminLogs(allLogs);
      } else {
        setAllAdminLogs([]);
      }
    });
    return () => unsubAllLogs();
  }, [adminProfile]);

  // --- Derived Data ---
  const filteredStudents = useMemo(() => {
    let result = allStudents;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          (s.id && s.id.toString().includes(q)) ||
          (s["ឈ្មោះ"] && s["ឈ្មោះ"].toLowerCase().includes(q))
      );
    }
    if (activeTab === "pending") {
      result = result.filter(
        (s) => !s["រូបថត"] || s["រូបថត"] === "n/a" || s["រូបថត"] === ""
      );
    } else if (activeTab === "delete") {
      result = result.filter(
        (s) =>
          s["រូបថត"] &&
          s["រូបថត"] !== "n/a" &&
          s["រូបថត"] !== "" &&
          s["រូបថត"].includes("cloudinary")
      );
    }
    return result;
  }, [allStudents, searchQuery, activeTab]);

  const visibleStudents = useMemo(
    () => filteredStudents.slice(0, displayLimit),
    [filteredStudents, displayLimit]
  );

  const adminCaptureStats = useMemo(() => {
    if (!adminProfile || adminProfile.id !== "250") return [];
    const stats = ALLOWED_ADMIN_IDS.map((adminId) => {
      const admin = adminList.find((a) => a.id === adminId);
      const uploadLogs = allAdminLogs.filter(
        (log) => log.adminId === adminId && log.action === "UPLOAD_PHOTO"
      );
      const deleteLogs = allAdminLogs.filter(
        (log) => log.adminId === adminId && log.action === "DELETE_PHOTO"
      );
      return {
        adminId,
        name: admin ? admin.name : `Admin ${adminId}`,
        isBlocked: admin ? admin.isBlocked : false,
        uploadCount: uploadLogs.length,
        deleteCount: deleteLogs.length,
        lastUpload: uploadLogs.length > 0 ? uploadLogs[0].timestamp : null,
      };
    });
    return stats.sort((a, b) => b.uploadCount - a.uploadCount);
  }, [adminList, allAdminLogs, adminProfile]);

  const isSuperAdmin = adminProfile && adminProfile.id === "250";

  // --- Actions ---
  const showAlert = (message, type = "success") => {
    setAlertState({ isOpen: true, message, type });
    setTimeout(
      () => setAlertState((prev) => ({ ...prev, isOpen: false })),
      3000
    );
  };

  const showConfirm = (title, message, onConfirm) => {
    setConfirmState({ isOpen: true, title, message, onConfirm });
  };

  const handleLogin = (adminId) => {
    if (!ALLOWED_ADMIN_IDS.includes(adminId)) {
      showAlert("លេខអ្នកគ្រប់គ្រងមិនត្រឹមត្រូវ", "error");
      return;
    }
    const admin = adminList.find((a) => a.id === adminId);
    if (!admin) {
      showAlert("រកមិនឃើញទិន្នន័យ", "error");
      return;
    }
    if (admin.isBlocked) {
      showAlert("គណនីអ្នកគ្រប់គ្រងត្រូវបានបិទ", "error");
      return;
    }

    const profile = {
      id: adminId,
      name: admin.name,
      verified: true,
      isSuperAdmin: adminId === "250",
    };

    // Set profile and save
    setAdminProfile(profile);
    localStorage.setItem("adminData", JSON.stringify(profile));

    // Trigger Policy Modal instead of standard alert
    setShowPolicyModal(true);
  };

  const handlePolicyAccept = () => {
    setShowPolicyModal(false);
    setShowWelcomeModal(true);
    // Auto hide welcome message after 3 seconds
    setTimeout(() => {
      setShowWelcomeModal(false);
    }, 3000);
  };

  const handlePolicyReject = () => {
    setAdminProfile(null);
    localStorage.removeItem("adminData");
    setShowPolicyModal(false);
    showAlert("អ្នកបានបដិសេធគោលការណ៍", "error");
  };

  const handleLogout = () => {
    showConfirm("ចាកចេញ", "តើអ្នកពិតជាចង់ចាកចេញមែនទេ?", () => {
      setAdminProfile(null);
      localStorage.removeItem("adminData");
      setActiveTab("home");
      setConfirmState({
        isOpen: false,
        title: "",
        message: "",
        onConfirm: null,
      });
    });
  };

  // ... (Other action handlers remain the same: handleDeletePhoto, handleBatchDelete, etc.)
  const handleDeletePhoto = (studentId) => {
    showConfirm(
      "លុបរូបភាព",
      "សកម្មភាពនេះមិនអាចត្រឡប់ក្រោយវិញទេ។ លុបរូបភាពនិស្សិត?",
      async () => {
        try {
          await update(ref(db, `students/${studentId}`), { រូបថត: "" });
          push(ref(db, `admin_logs/${adminProfile.id}`), {
            action: "DELETE_PHOTO",
            studentId,
            timestamp: serverTimestamp(),
          });
          showAlert("លុបរូបភាពបានជោគជ័យ!");
        } catch (err) {
          showAlert("បរាជ័យក្នុងការលុបរូបភាព", "error");
        }
        setConfirmState({
          isOpen: false,
          title: "",
          message: "",
          onConfirm: null,
        });
      }
    );
  };

  const handleBatchDelete = () => {
    const count = selectedImages.size;
    showConfirm(
      "លុបរូបភាពជាក្រុម",
      `សកម្មភាពនេះមិនអាចត្រឡប់ក្រោយវិញទេ។ លុបរូបភាពនិស្សិត ${count} រូប?`,
      async () => {
        try {
          const updates = {};
          selectedImages.forEach((studentId) => {
            updates[`students/${studentId}/រូបថត`] = "";
          });
          await update(ref(db), updates);
          push(ref(db, `admin_logs/${adminProfile.id}`), {
            action: "BATCH_DELETE_PHOTOS",
            count,
            timestamp: serverTimestamp(),
          });
          showAlert(`លុបរូបភាព ${count} បានជោគជ័យ!`);
          setSelectedImages(new Set());
          setShowBatchActions(false);
        } catch (err) {
          showAlert("បរាជ័យក្នុងការលុបរូបភាព", "error");
        }
        setConfirmState({
          isOpen: false,
          title: "",
          message: "",
          onConfirm: null,
        });
      }
    );
  };

  const toggleImageSelection = (studentId) => {
    const newSelection = new Set(selectedImages);
    if (newSelection.has(studentId)) newSelection.delete(studentId);
    else newSelection.add(studentId);
    setSelectedImages(newSelection);
    setShowBatchActions(newSelection.size > 0);
  };

  const handleBlockAdmin = (adminId, isBlocked) => {
    const action = isBlocked ? "ដោះសោ" : "បិទ";
    showConfirm(
      `${action} អ្នកគ្រប់គ្រង`,
      `តើអ្នកពិតជាចង់${action}អ្នកគ្រប់គ្រងនេះ?`,
      async () => {
        try {
          await update(ref(db, `students/${adminId}`), {
            isBlocked: !isBlocked,
          });
          showAlert(`${action}អ្នកគ្រប់គ្រងបានជោគជ័យ!`);
          setConfirmState({
            isOpen: false,
            title: "",
            message: "",
            onConfirm: null,
          });
        } catch (err) {
          showAlert("បរាជ័យក្នុងការធ្វើប្រតិបត្តិការ", "error");
        }
      }
    );
  };

  const handleAddAdmin = () => {
    if (!addAdminState.adminId || !addAdminState.adminName) {
      showAlert("សូមបញ្ចូលព័ត៌មានអោយបានគ្រប់គ្រាន់", "error");
      return;
    }
    const student = allStudents.find((s) => s.id === addAdminState.adminId);
    if (!student) {
      showAlert("រកមិនឃើញលេខនិស្សិតនេះទេ", "error");
      return;
    }
    showConfirm(
      "បន្ថែមអ្នកគ្រប់គ្រងថ្មី",
      `បន្ថែម ${addAdminState.adminName} ជាអ្នកគ្រប់គ្រង?`,
      async () => {
        try {
          await update(ref(db, `students/${addAdminState.adminId}`), {
            isAdmin: true,
            isBlocked: false,
          });
          showAlert("បន្ថែមអ្នកគ្រប់គ្រងបានជោគជ័យ!");
          setAddAdminState({ isOpen: false, adminId: "", adminName: "" });
          setConfirmState({
            isOpen: false,
            title: "",
            message: "",
            onConfirm: null,
          });
        } catch (err) {
          showAlert("បរាជ័យក្នុងការបន្ថែមអ្នកគ្រប់គ្រង", "error");
        }
      }
    );
  };

  const handleViewAdminDetails = (adminId) => {
    const admin = adminList.find((a) => a.id === adminId);
    if (admin) setSelectedAdminDetails(admin);
  };

  const handleScroll = (e) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 100) {
      if (displayLimit < filteredStudents.length)
        setDisplayLimit((prev) => prev + 20);
    }
  };

  if (!adminProfile)
    return <LoginScreen onLogin={handleLogin} isLoading={loading} />;

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden relative font-battambang">
      {/* Header Updated with Right-Side Info */}
      <Header
        adminName={adminProfile.name}
        adminId={adminProfile.id}
        onLogout={handleLogout}
      />

      <div
        className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth no-scrollbar pb-20"
        onScroll={handleScroll}
      >
        {activeTab === "admin" ? (
          <AdminDashboard
            admin={adminProfile}
            allStudents={allStudents}
            adminLogs={adminLogs}
            adminList={adminList}
            capturedCount={capturedCount}
            isSuperAdmin={isSuperAdmin}
            adminCaptureStats={adminCaptureStats}
            onBlockAdmin={handleBlockAdmin}
            onAddAdmin={() =>
              setAddAdminState({ isOpen: true, adminId: "", adminName: "" })
            }
            onViewAdminDetails={handleViewAdminDetails}
            onDeletePhoto={handleDeletePhoto}
          />
        ) : activeTab === "delete" ? (
          <DeleteMode
            students={visibleStudents}
            viewMode={deleteViewMode}
            setViewMode={setDeleteViewMode}
            searchQuery={searchQuery}
            setSearchQuery={(v) => {
              setSearchQuery(v);
              setDisplayLimit(20);
            }}
            total={filteredStudents.length}
            selectedImages={selectedImages}
            toggleImageSelection={toggleImageSelection}
            showBatchActions={showBatchActions}
            onBatchDelete={handleBatchDelete}
            onDeletePhoto={handleDeletePhoto}
          />
        ) : (
          <div className="px-3 py-2 space-y-3">
            <SearchBar
              value={searchQuery}
              onChange={(v) => {
                setSearchQuery(v);
                setDisplayLimit(20);
              }}
              activeTab={activeTab}
              count={filteredStudents.length}
            />
            <div className="space-y-2 min-h-[50vh]">
              {visibleStudents.map((student) => (
                <StudentCard
                  key={student.id}
                  student={student}
                  mode={activeTab}
                  onCamera={() =>
                    setCameraState({
                      isOpen: true,
                      studentId: student.id,
                      studentName: student["ឈ្មោះ"],
                    })
                  }
                  onDelete={() => handleDeletePhoto(student.id)}
                />
              ))}
              {visibleStudents.length === 0 && !loading && (
                <div className="text-center py-12 text-slate-400 flex flex-col items-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                    <Search className="h-6 w-6 text-slate-300" />
                  </div>
                  <p className="font-medium text-sm">រកមិនឃើញលទ្ធផល</p>
                </div>
              )}
              {displayLimit < filteredStudents.length && (
                <div className="py-3 text-center">
                  <RefreshCw className="h-5 w-5 animate-spin text-indigo-500 mx-auto" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <BottomNav
        activeTab={activeTab}
        onChange={setActiveTab}
        pendingCount={
          allStudents.filter(
            (s) => !s["រូបថត"] || s["រូបថត"] === "n/a" || s["រូបថត"] === ""
          ).length
        }
      />

      {/* --- Feature Modals --- */}
      {cameraState.isOpen && (
        <CameraModal
          studentName={cameraState.studentName}
          onClose={() => setCameraState({ ...cameraState, isOpen: false })}
          onCapture={(blob) => {
            setCameraState({ ...cameraState, isOpen: false });
            setPreviewState({ isOpen: true, blob, isUploading: false });
          }}
        />
      )}

      {previewState.isOpen && (
        <PreviewModal
          blob={previewState.blob}
          studentName={cameraState.studentName}
          isUploading={previewState.isUploading}
          onRetake={() => {
            setPreviewState({ isOpen: false, blob: null, isUploading: false });
            setCameraState({ ...cameraState, isOpen: true });
          }}
          onCancel={() =>
            setPreviewState({ isOpen: false, blob: null, isUploading: false })
          }
          onConfirm={async () => {
            setPreviewState((prev) => ({ ...prev, isUploading: true }));
            try {
              const formData = new FormData();
              formData.append("file", previewState.blob);
              formData.append("upload_preset", CLOUDINARY_PRESET);
              const res = await fetch(CLOUDINARY_URL, {
                method: "POST",
                body: formData,
              });
              const data = await res.json();
              if (data.secure_url) {
                await update(ref(db, `students/${cameraState.studentId}`), {
                  រូបថត: data.secure_url,
                });
                push(ref(db, `admin_logs/${adminProfile.id}`), {
                  action: "UPLOAD_PHOTO",
                  studentId: cameraState.studentId,
                  timestamp: serverTimestamp(),
                });
                setPreviewState({
                  isOpen: false,
                  blob: null,
                  isUploading: false,
                });
                showAlert("បញ្ចូលរូបភាពបានជោគជ័យ!");
              } else {
                throw new Error("Upload failed");
              }
            } catch (e) {
              setPreviewState((prev) => ({ ...prev, isUploading: false }));
              showAlert("បរាជ័យក្នុងការបញ្ចូល។ សូមព្យាយាមម្តងទៀត។", "error");
            }
          }}
        />
      )}

      {/* Admin Management Modals */}
      {addAdminState.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() =>
              setAddAdminState({ isOpen: false, adminId: "", adminName: "" })
            }
          ></div>
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-2xl relative z-10 animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-slate-800 mb-4 tittle">
              បន្ថែមអ្នកគ្រប់គ្រងថ្មី
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  លេខនិស្សិត
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="បញ្ចូលលេខនិស្សិត"
                  value={addAdminState.adminId}
                  onChange={(e) =>
                    setAddAdminState((prev) => ({
                      ...prev,
                      adminId: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  ឈ្មោះ
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="បញ្ចូលឈ្មោះ"
                  value={addAdminState.adminName}
                  onChange={(e) =>
                    setAddAdminState((prev) => ({
                      ...prev,
                      adminName: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() =>
                  setAddAdminState({
                    isOpen: false,
                    adminId: "",
                    adminName: "",
                  })
                }
                className="flex-1 py-2 rounded-lg bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition-colors"
              >
                បោះបង់
              </button>
              <button
                onClick={handleAddAdmin}
                className="flex-1 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
              >
                បន្ថែម
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedAdminDetails && (
        <AdminDetailsModal
          admin={selectedAdminDetails}
          allStudents={allStudents}
          allAdminLogs={allAdminLogs}
          onClose={() => setSelectedAdminDetails(null)}
          onDeletePhoto={handleDeletePhoto}
        />
      )}

      {/* --- SYSTEM POLICY MODAL --- */}
      {showPolicyModal && (
        <SystemPolicyModal
          onAccept={handlePolicyAccept}
          onReject={handlePolicyReject}
        />
      )}

      {/* --- WELCOME MODAL --- */}
      {showWelcomeModal && (
        <WelcomeModal onClose={() => setShowWelcomeModal(false)} />
      )}

      {/* Utility Modals */}
      <AlertToast
        isOpen={alertState.isOpen}
        message={alertState.message}
        type={alertState.type}
      />
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={() =>
          setConfirmState({
            isOpen: false,
            title: "",
            message: "",
            onConfirm: null,
          })
        }
      />
    </div>
  );
}

// --- NEW COMPONENTS ---

// 1. Updated Header
const Header = ({ adminName, adminId, onLogout }) => (
  <header className="bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg z-30 sticky top-0">
    <div className="px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-lg overflow-hidden shadow-lg border border-white/20">
          <img
            src="https://i.postimg.cc/FHBn0Fdf/di3-copy.png"
            alt="Logo"
            className="w-full h-full object-cover"
          />
        </div>
        <div>
          <h1 className="font-bold text-white leading-none tittle">
            គ្រប់គ្រងទិន្នន័យរូបភាព
          </h1>
        </div>
      </div>

      {/* Right Side: Admin Info and Logout */}
      <div className="flex items-center gap-2">
        <div className="text-right">
          <p className="text-[10px] text-indigo-100 font-bold uppercase tracking-wider opacity-80 mb-[1px]">
            {adminId === "250" ? "អ្នកគ្រប់គ្រង" : "គណនី"}
          </p>
          <p className="text-xs text-white leading-none tittle">
            {adminName}
          </p>
        </div>
        <button
          onClick={onLogout}
          className="w-8 h-8 ml-1 bg-white/20 hover:bg-white/30 text-white rounded-lg flex items-center justify-center transition-all backdrop-blur-sm"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  </header>
);

// 2. System Policy Modal
const SystemPolicyModal = ({ onAccept, onReject }) => (
  <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/70 backdrop-blur-md"></div>
    <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl relative z-10 animate-in fade-in zoom-in duration-300 border-t-4 border-indigo-600">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-3">
          <ShieldCheck className="h-8 w-8 text-indigo-600" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 tittle">
          គោលការណ៍ប្រើប្រាស់ប្រព័ន្ធ
        </h2>
        <p className="text-xs text-slate-500 mt-1 font-medium">
          សូមអាន និងយល់ព្រមចំពោះគោលការណ៍ខាងក្រោម មុននឹងបន្តប្រើប្រាស់ប្រព័ន្ធ។
        </p>
      </div>

      <div className="space-y-3 mb-8">
        <PolicyItem text="កុំចែករំលែកព័ត៌មាន ឬគណនីទៅអ្នកដទៃ។" />
        <PolicyItem text="ប្រើប្រាស់ប្រព័ន្ធត្រឹមត្រូវតាមគោលបំណង និងបទបញ្ជា។" />
        <PolicyItem text="ការបញ្ចូលទិន្នន័យត្រូវតែមានភាពត្រឹមត្រូវ និងពិនិត្យម្តងទៀត។" />
        <PolicyItem text="យើងរក្សាសិទ្ធិបិទ ឬ ទប់ស្កាត់គណនី ប្រសិនបើមានការបំពានលក្ខខណ្ឌ។" />
        <PolicyItem text="ការប្រើប្រាស់ត្រូវគោរពសុវត្ថិភាពទិន្នន័យ និងឯកជនភាពរបស់អ្នកដទៃ។" />
      </div>

      <div className="flex gap-3">
        <button
          onClick={onReject}
          className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-colors"
        >
          បដិសេធ
        </button>
        <button
          onClick={onAccept}
          className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-colors"
        >
          យល់ព្រម និង បន្ត
        </button>
      </div>
    </div>
  </div>
);

const PolicyItem = ({ text }) => (
  <div className="flex items-start gap-3">
    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></div>
    <p className="text-xs text-slate-600 leading-relaxed font-medium">{text}</p>
  </div>
);

// 3. Welcome Modal
const WelcomeModal = ({ onClose }) => (
  <div className="fixed top-0 left-0 w-full h-full pointer-events-none flex items-center justify-center z-[200] p-4">
    <div
      className="absolute inset-0 bg-black/20 backdrop-blur-sm pointer-events-auto"
      onClick={onClose}
    ></div>
    <div className="pointer-events-auto bg-white rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center animate-in slide-in-from-bottom duration-500 max-w-xs w-full relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-emerald-600"></div>

      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 animate-bounce">
        <CheckCircle2 className="h-8 w-8 text-green-600" />
      </div>

      <h3 className="text-xl font-bold text-slate-800 mb-2 tittle">
        សូមស្វាគមន៍!
      </h3>
      <p className="text-sm text-slate-600 mb-4 font-medium">
        សូមស្វាគមន៍មកកាន់ប្រព័ន្ធរបស់យើង។ អរគុណដែលបានយល់ព្រមគោលការណ៍ប្រើប្រាស់។
      </p>
      <p className="text-xs text-indigo-500 font-bold">
        សូមអោយលោកអ្នកមានបទពិសោធន៍ប្រើប្រាស់ល្អ!
      </p>
    </div>
  </div>
);

// --- EXISTING COMPONENTS (Login, SearchBar, etc.) ---

const LoginScreen = ({ onLogin, isLoading }) => {
  const [val, setVal] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-battambang">
      {/* Background decorative elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-1000"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

          <div className="text-center mb-8">
            <div className="relative inline-block mb-6">
              <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-2xl transform hover:scale-105 transition-transform duration-300">
                <img
                  src="https://i.postimg.cc/FHBn0Fdf/di3-copy.png"
                  alt="Logo"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <h1 className="text-3xl font-bold text-white mb-2 tittle">
              គ្រប់គ្រងទិន្នន័យរូបភាព
            </h1>
            <p className="text-indigo-200 text-sm font-medium">
              ប្រព័ន្ធគ្រប់គ្រងទិន្នន័យនិស្សិត
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              onLogin(val);
            }}
            className="space-y-6"
          >
            <div className="relative">
              <label className="block text-indigo-200 text-xs font-bold uppercase tracking-wider mb-2">
                លេខអ្នកគ្រប់គ្រង
              </label>
              <div
                className={`relative transition-all duration-300 ${
                  isFocused ? "transform -translate-y-1" : ""
                }`}
              >
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <ShieldCheck
                    className={`h-5 w-5 transition-colors duration-300 ${
                      isFocused ? "text-indigo-400" : "text-indigo-300"
                    }`}
                  />
                </div>
                <input
                  type="text"
                  className={`w-full pl-12 pr-4 py-4 rounded-xl bg-white/10 backdrop-blur-sm border text-white placeholder-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-500/50 focus:bg-white/15 transition-all font-bold text-center text-lg tracking-widest ${
                    isFocused ? "border-indigo-400" : "border-white/20"
                  }`}
                  placeholder="បញ្ចូលលេខ"
                  value={val}
                  onChange={(e) => setVal(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  disabled={isLoading}
                />
                {val && (
                  <button
                    type="button"
                    onClick={() => setVal("")}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-indigo-300 hover:text-white transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !val}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-4 rounded-xl shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {isLoading ? (
                  <>
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    <span>កំពុងផ្ទៀងផ្ទាត់...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-5 w-5" />
                    <span>ចូលប្រព័ន្ធ</span>
                  </>
                )}
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// ... (Rest of components: SearchBar, StudentCard, DeleteMode, DeleteImageCard, DeleteImageListItem, AdminDashboard, CameraModal, PreviewModal, AdminDetailsModal, AlertToast, ConfirmModal, BottomNav remain essentially same, just ensuring imports are correct in the main block)

const SearchBar = ({ value, onChange, activeTab, count }) => (
  <div className="sticky top-0 z-20 pt-1 pb-2 bg-slate-50/95 backdrop-blur-sm">
    <div className="relative group">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
      </div>
      <input
        type="text"
        className="block w-full pl-10 pr-8 py-2.5 border-none rounded-xl bg-white shadow-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 transition-all font-medium text-sm"
        placeholder={
          activeTab === "home"
            ? "ស្វែងរកអត្ថលេខ ឬ ឈ្មោះ..."
            : activeTab === "pending"
            ? "ជ្រើសរើសនិស្សិតដែលខ្វះរូប..."
            : "ស្វែងរករូបភាពដែលត្រូវលុប..."
        }
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-300 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
    <div className="flex justify-between items-center mt-2 px-1">
      <div className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          {count} និស្សិត
        </span>
      </div>
      {activeTab !== "home" && (
        <span
          className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${
            activeTab === "pending"
              ? "bg-amber-100 text-amber-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {activeTab === "pending" ? "រូបភាពខ្វះ" : "លុបរូបភាព"}
        </span>
      )}
    </div>
  </div>
);

const StudentCard = ({ student, mode, onCamera, onDelete }) => {
  const hasImage =
    student["រូបថត"] && student["រូបថត"] !== "n/a" && student["រូបថត"] !== "";
  return (
    <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 flex items-center gap-3 hover:shadow-md transition-all">
      <div className="relative shrink-0">
        {hasImage ? (
          <div className="w-12 h-12 rounded-xl p-0.5 bg-gradient-to-tr from-green-400 to-emerald-600 shadow-sm">
            <img
              src={student["រូបថត"]}
              alt="Student"
              className="w-full h-full object-cover rounded-lg border border-white"
            />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 text-slate-300">
            <User className="h-5 w-5" />
          </div>
        )}
        <div className="absolute -bottom-1 -right-1 bg-slate-800 text-white text-[9px] px-1.5 py-0.5 rounded font-mono font-bold shadow-sm">
          {student.id}
        </div>
      </div>
      <div className="flex-1 min-w-0 py-0.5">
        <h3 className="font-bold text-slate-800 truncate text-base">
          {student["ឈ្មោះ"] || "មិនស្គាល់ឈ្មោះ"}
        </h3>
        <p className="text-xs text-slate-500 font-medium bg-slate-100 inline-block px-2 py-0.5 rounded truncate max-w-full">
          {student["ជំនាញ"] || "និស្សិតទូទៅ"}
        </p>
      </div>
      <div className="flex items-center">
        {mode === "home" && !hasImage && (
          <button
            onClick={onCamera}
            className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
          >
            <Camera className="h-4 w-4" />
          </button>
        )}
        {mode === "pending" && (
          <button
            onClick={onCamera}
            className="h-9 px-3 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-md shadow-indigo-200 hover:bg-indigo-700 hover:shadow-lg transition-all flex items-center gap-1"
          >
            <Camera className="h-3.5 w-3.5" />
            <span>ថត</span>
          </button>
        )}
        {mode === "delete" && hasImage && (
          <button
            onClick={onDelete}
            className="w-9 h-9 bg-red-50 text-red-500 rounded-lg flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};

// ... Include rest of components from previous code (DeleteMode, AdminDashboard, etc.) normally ...
// For brevity, I am ensuring the core changes requested (Header + Policy Popup) are fully implemented above.
// The provided code block is complete for the requested features.

const DeleteMode = ({
  students,
  viewMode,
  setViewMode,
  searchQuery,
  setSearchQuery,
  total,
  selectedImages,
  toggleImageSelection,
  showBatchActions,
  onBatchDelete,
  onDeletePhoto,
}) => {
  return (
    <div className="px-3 py-2 space-y-3">
      <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
              <Database className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-sm tittle">
                គ្រប់គ្រងរូបភាព
              </h2>
              <p className="text-xs text-slate-500">បញ្ចូលតាមប្រព័ន្ធ</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === "grid"
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              <Grid3X3 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === "list"
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="mt-3 relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          </div>
          <input
            type="text"
            className="block w-full pl-9 pr-8 py-2 border-none rounded-lg bg-slate-50 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 transition-all font-medium text-sm"
            placeholder="ស្វែងរកអត្ថលេខ ឬ ឈ្មោះ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-300 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {total} រូបភាព
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500">ជ្រើសរើស:</span>
            <span className="text-sm font-bold text-indigo-600">
              {selectedImages.size}
            </span>
          </div>
        </div>
      </div>
      {showBatchActions && (
        <div className="bg-indigo-600 text-white rounded-lg p-2.5 flex items-center justify-between animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="text-xs font-medium">
              ជ្រើសរើស {selectedImages.size}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSelectedImages(new Set())}
              className="px-2 py-1 bg-white/20 rounded-lg text-xs font-medium hover:bg-white/30 transition-colors"
            >
              បោះបង់
            </button>
            <button
              onClick={onBatchDelete}
              className="px-2 py-1 bg-red-500 rounded-lg text-xs font-medium hover:bg-red-600 transition-colors flex items-center gap-1"
            >
              <Trash2 className="h-3 w-3" />
              លុប
            </button>
          </div>
        </div>
      )}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-3 gap-2">
          {students.map((student) => (
            <DeleteImageCard
              key={student.id}
              student={student}
              isSelected={selectedImages.has(student.id)}
              onSelect={() => toggleImageSelection(student.id)}
              onDelete={() => onDeletePhoto(student.id)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="divide-y divide-slate-100">
            {students.map((student) => (
              <DeleteImageListItem
                key={student.id}
                student={student}
                isSelected={selectedImages.has(student.id)}
                onSelect={() => toggleImageSelection(student.id)}
                onDelete={() => onDeletePhoto(student.id)}
              />
            ))}
          </div>
        </div>
      )}
      {students.length === 0 && (
        <div className="text-center py-12 text-slate-400 flex flex-col items-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-3">
            <ImageOff className="h-6 w-6 text-slate-300" />
          </div>
          <p className="font-medium text-sm">រកមិនឃើញរូបភាព</p>
        </div>
      )}
    </div>
  );
};

const DeleteImageCard = ({ student, isSelected, onSelect, onDelete }) => (
  <div
    className={`relative group rounded-lg overflow-hidden shadow-sm border-2 transition-all ${
      isSelected
        ? "border-indigo-500 shadow-md"
        : "border-transparent hover:border-slate-200"
    }`}
  >
    <div
      className={`absolute inset-0 bg-indigo-500/20 z-10 flex items-center justify-center transition-opacity ${
        isSelected ? "opacity-100" : "opacity-0"
      }`}
      onClick={onSelect}
    >
      <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg">
        <CheckCircle2 className="h-5 w-5 text-indigo-600" />
      </div>
    </div>
    <div className="aspect-square bg-slate-100 relative">
      <img
        src={student["រូបថត"]}
        alt={student["ឈ្មោះ"]}
        className="w-full h-full object-cover"
      />
      <div className="absolute top-1 left-1 bg-black/50 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">
        {student.id}
      </div>
      <button
        onClick={onDelete}
        className="absolute bottom-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
    <div className="p-2 bg-white">
      <h3 className="font-medium text-slate-800 truncate text-xs">
        {student["ឈ្មោះ"]}
      </h3>
    </div>
    <button
      onClick={onSelect}
      className="absolute top-1 right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-md z-20"
    >
      {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600" />}
    </button>
  </div>
);

const DeleteImageListItem = ({ student, isSelected, onSelect, onDelete }) => (
  <div
    className={`p-3 flex items-center gap-3 transition-colors ${
      isSelected ? "bg-indigo-50" : "hover:bg-slate-50"
    }`}
  >
    <button
      onClick={onSelect}
      className="w-4 h-4 rounded border-2 border-slate-300 flex items-center justify-center"
    >
      {isSelected && <CheckCircle2 className="h-3 w-3 text-indigo-600" />}
    </button>
    <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
      <img
        src={student["រូបថត"]}
        alt={student["ឈ្មោះ"]}
        className="w-full h-full object-cover"
      />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="font-medium text-slate-800 truncate text-sm">
          {student["ឈ្មោះ"]}
        </h3>
        <span className="text-[9px] font-mono text-slate-500 bg-slate-100 px-1 py-0.5 rounded">
          {student.id}
        </span>
      </div>
      <p className="text-xs text-indigo-600 flex items-center gap-1">
        <Clock className="h-2.5 w-2.5" />
        បញ្ចូលតាមប្រព័ន្ធ
      </p>
    </div>
    <button
      onClick={onDelete}
      className="w-7 h-7 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  </div>
);

const AdminDashboard = ({
  admin,
  allStudents,
  adminLogs,
  adminList,
  capturedCount,
  isSuperAdmin,
  adminCaptureStats,
  onBlockAdmin,
  onAddAdmin,
  onViewAdminDetails,
  onDeletePhoto,
}) => {
  const totalStudents = allStudents.length;
  const completionRate =
    totalStudents > 0 ? Math.round((capturedCount / totalStudents) * 100) : 0;
  const uploadLogs = adminLogs
    .filter((log) => log.action === "UPLOAD_PHOTO")
    .slice(0, 8);
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "មិនស្គាល់ពេល";
    return new Date(timestamp).toLocaleString("km-KH", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="px-3 py-2 space-y-4">
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 p-5 text-white shadow-lg">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-lg overflow-hidden shadow-lg bg-white/10">
              <img
                src="https://i.postimg.cc/FHBn0Fdf/di3-copy.png"
                alt="Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="text-indigo text-medium font-bold uppercase tracking-wider tittle">
                ផ្ទាំងអ្នកគ្រប់គ្រង
              </p>
              <p className="text-indigo-200 text-sm">
                សូមស្វាគមន៍, {admin.name}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm border border-white/5 text-center">
              <p className="text-indigo-100 text-[14px] font-bold uppercase tittle">
                សរុប
              </p>
              <p className="text-2xl font-bold mt-1">{totalStudents}</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm border border-white/5 text-center">
              <p className="text-indigo-100 text-[14px] font-bold uppercase tittle">
                បានថត
              </p>
              <p className="text-2xl font-bold mt-1">{capturedCount}</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm border border-white/5 text-center">
              <p className="text-indigo-100 text-[14px] font-bold uppercase tittle">
                គិតជា%
              </p>
              <p className="text-2xl font-bold mt-1">{completionRate}%</p>
            </div>
          </div>
        </div>
      </div>
      {isSuperAdmin && (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-4 py-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2 tittle">
                <BarChart3 className="h-4 w-4 text-indigo-600" />
                ស្ថិតិអ្នកគ្រប់គ្រង
              </h3>
            </div>
            <div className="p-4">
              <div className="space-y-3">
                {adminCaptureStats.map((stat) => (
                  <div
                    key={stat.adminId}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                    onClick={() => onViewAdminDetails(stat.adminId)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <User className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-slate-800 text-sm">
                          {stat.name}
                        </h4>
                        <span className="text-[9px] font-mono text-slate-500 bg-slate-100 px-1 py-0.5 rounded">
                          {stat.adminId}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-slate-500">បញ្ចូល:</span>
                        <span className="text-lg font-bold text-indigo-600">
                          {stat.uploadCount}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">លុប:</span>
                        <span className="text-lg font-bold text-red-500">
                          {stat.deleteCount}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2 tittle">
                <User className="h-4 w-4 text-indigo-600" />
                អ្នកគ្រប់គ្រង ({adminList.length})
              </h3>
              <button
                onClick={onAddAdmin}
                className="px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1"
              >
                <UserPlus className="h-3 w-3" />
                បន្ថែម
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {adminList.map((admin) => (
                <div
                  key={admin.id}
                  className="p-3 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <User className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-slate-800 text-sm">
                      {admin.name}
                    </h4>
                    <span className="text-[9px] font-mono text-slate-500 bg-slate-100 px-1 py-0.5 rounded">
                      {admin.id}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        admin.isBlocked
                          ? "bg-red-100 text-red-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {admin.isBlocked ? "បិទ" : "សកម្ម"}
                    </span>
                    {admin.id !== "250" && (
                      <button
                        onClick={() => onBlockAdmin(admin.id, admin.isBlocked)}
                        className={`text-xs font-medium hover:underline flex items-center gap-1 ${
                          admin.isBlocked ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {admin.isBlocked ? (
                          <>
                            <Unlock className="h-3 w-3" />
                            អនុញ្ញាត
                          </>
                        ) : (
                          <>
                            <Lock className="h-3 w-3" />
                            ដោះសោ
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 px-4 py-3 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-base flex items-center gap-2 tittle">
            <Camera className="h-4 w-4 text-indigo-600" />
            ថតថ្មីៗ
          </h3>
        </div>
        {uploadLogs.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {uploadLogs.map((log) => {
              const student = allStudents.find((s) => s.id === log.studentId);
              if (!student) return null;
              return (
                <div
                  key={log.id}
                  className="p-3 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                    {student["រូបថត"] ? (
                      <img
                        src={student["រូបថត"]}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-full h-full p-2.5 text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-slate-800 text-sm">
                        {student["ឈ្មោះ"]}
                      </h4>
                      <span className="text-[9px] font-mono text-slate-500 bg-slate-100 px-1 py-0.5 rounded">
                        {student.id}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Clock className="h-2.5 w-2.5" />
                      <span>{formatTimestamp(log.timestamp)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => onDeletePhoto(student.id)}
                    className="w-7 h-7 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-center text-slate-400">
            <Camera className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="font-medium text-sm">មិនទាន់មានការថត</p>
          </div>
        )}
      </div>
    </div>
  );
};

// --- CameraModal Component ---
const CameraModal = ({ onClose, onCapture, studentName }) => {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isMirrored, setIsMirrored] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // Request camera access
    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: "environment", // Default to back camera
          width: { ideal: 1920 },    // High res ideal, but browser will adapt
          height: { ideal: 1080 },
        },
        audio: false,
      })
      .then((s) => {
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
        setIsInitializing(false);
      })
      .catch((err) => {
        console.error("Camera Error:", err);
        alert("មិនអាចចូលដំណើរការកាមេរ៉ាបានទេ (Cannot access camera)");
        onClose();
      });

    return () => {
      // Cleanup stream on unmount
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const takePicture = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    
    // 1. Determine the size of the square crop based on the shortest video dimension
    // This ensures we get the maximum resolution square possible from the center
    const size = Math.min(video.videoWidth, video.videoHeight);
    
    // 2. Set canvas to a square
    canvas.width = size;
    canvas.height = size;
    
    const ctx = canvas.getContext("2d");

    // 3. Handle Mirroring (Horizontal flip)
    if (isMirrored) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    // 4. Calculate cropping coordinates to get the exact center square
    // This logic matches the visual "square overlay" in the UI
    const startX = (video.videoWidth - size) / 2;
    const startY = (video.videoHeight - size) / 2;

    // 5. Draw the cropped image
    // drawImage(source, sourceX, sourceY, sourceW, sourceH, destX, destY, destW, destH)
    ctx.drawImage(
      video,
      startX,
      startY,
      size,
      size,
      0,
      0,
      canvas.width,
      canvas.height
    );

    // 6. Convert to blob
    canvas.toBlob((blob) => onCapture(blob), "image/jpeg", 0.95);
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col animate-in fade-in zoom-in duration-200">
      {/* Header */}
      <div className="flex justify-between items-center p-4 text-white z-20 absolute top-0 w-full">
        <div className="bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
          <p className="font-bold text-sm text-shadow">{studentName}</p>
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 bg-black/40 rounded-full flex items-center justify-center backdrop-blur-md hover:bg-white/20 transition-colors border border-white/10"
        >
          <X className="h-5 w-5 text-white" />
        </button>
      </div>

      {/* Camera Viewport */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-black">
        {isInitializing && (
          <div className="absolute inset-0 flex items-center justify-center text-white/50 z-0">
             <RefreshCw className="animate-spin h-8 w-8" />
          </div>
        )}
        
        {/* Video Element */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute w-full h-full object-cover transition-transform duration-300 ${
            isMirrored ? "scale-x-[-1]" : ""
          }`}
        />

        {/* The Square Overlay (The "Guide") */}
        <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
          {/* Darken surrounding area */}
          <div className="absolute inset-0 bg-black/50">
             {/* Cutout for the square */}
             <div className="w-full h-full flex items-center justify-center">
                <div className="relative w-[85vw] max-w-[350px] aspect-square shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] border-2 border-white/80 rounded-xl">
                    {/* Optional: Corner markers for aesthetic */}
                    <div className="absolute top-[-2px] left-[-2px] w-4 h-4 border-t-4 border-l-4 border-white rounded-tl-sm"></div>
                    <div className="absolute top-[-2px] right-[-2px] w-4 h-4 border-t-4 border-r-4 border-white rounded-tr-sm"></div>
                    <div className="absolute bottom-[-2px] left-[-2px] w-4 h-4 border-b-4 border-l-4 border-white rounded-bl-sm"></div>
                    <div className="absolute bottom-[-2px] right-[-2px] w-4 h-4 border-b-4 border-r-4 border-white rounded-br-sm"></div>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Controls Footer */}
      <div className="h-36 bg-black flex items-center justify-around px-8 pb-6 pt-4 z-20">
        {/* Flip Button */}
        <button
          onClick={() => setIsMirrored(!isMirrored)}
          className={`p-4 rounded-full transition-all border ${
            isMirrored
              ? "bg-indigo-600/20 border-indigo-500 text-indigo-400"
              : "bg-zinc-800 border-zinc-700 text-zinc-400"
          }`}
        >
          <FlipHorizontal className="h-6 w-6" />
        </button>

        {/* Capture Button */}
        <button
          onClick={takePicture}
          className="w-20 h-20 rounded-full bg-white border-4 border-zinc-300 flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.3)] active:scale-90 transition-transform duration-150"
        >
          <div className="w-16 h-16 bg-white rounded-full border-2 border-zinc-200 flex items-center justify-center">
             <Camera className="h-6 w-6 text-zinc-400 opacity-50" />
          </div>
        </button>

        {/* Spacer to balance layout */}
        <div className="w-14"></div>
      </div>
    </div>
  );
};

// --- PreviewModal Component ---
const PreviewModal = ({
  blob,
  studentName,
  isUploading,
  onRetake,
  onConfirm,
  onCancel,
}) => {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[60] flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200">
      <div className="bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col w-full max-w-sm border border-zinc-800">
        
        {/* Image Preview Container */}
        <div className="relative bg-black flex items-center justify-center py-8">
          {/* Close button (only if not uploading) */}
          {!isUploading && (
            <button
              onClick={onCancel}
              className="absolute top-3 right-3 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur-md hover:bg-black/70 transition-colors z-10 border border-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {/* The Captured Image - Displayed as Square */}
          <div className="relative shadow-2xl rounded-lg overflow-hidden border border-white/20">
              <img
                src={url}
                alt="Preview"
                // 'aspect-square' ensures it looks exactly like the capture frame
                className="w-[80vw] max-w-[300px] aspect-square object-cover"
              />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-5 space-y-5 bg-zinc-900">
          <div className="text-center">
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-1">
              បញ្ជាក់រូបភាព
            </p>
            <h3 className="font-bold text-lg text-white">{studentName}</h3>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onRetake}
              disabled={isUploading}
              className="flex-1 py-3 rounded-xl bg-zinc-800 text-white font-medium hover:bg-zinc-700 transition-colors text-sm border border-zinc-700 active:scale-95 duration-100"
            >
              ថតម្តងទៀត
            </button>
            <button
              onClick={onConfirm}
              disabled={isUploading}
              className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition-colors flex items-center justify-center gap-2 text-sm shadow-lg shadow-indigo-900/20 active:scale-95 duration-100 disabled:opacity-50 disabled:active:scale-100"
            >
              {isUploading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {isUploading ? "កំពុងបញ្ចូល..." : "យល់ព្រម"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Updated AdminDetailsModal
const AdminDetailsModal = ({ admin, allStudents, allAdminLogs, onClose, onDeletePhoto }) => {
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterType, setFilterType] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('users');
  const [userViewMode, setUserViewMode] = useState('grid');
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [showBatchActions, setShowBatchActions] = useState(false);

  // Get all logs for this admin
  const adminLogs = useMemo(() => {
    let logs = allAdminLogs.filter(log => log.adminId === admin.id);

    if (filterType !== 'all') {
      logs = logs.filter(log =>
        filterType === 'upload' ? log.action === 'UPLOAD_PHOTO' : log.action === 'DELETE_PHOTO'
      );
    }

    const now = new Date();
    if (dateFilter === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      logs = logs.filter(log => log.timestamp && new Date(log.timestamp) >= today);
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      logs = logs.filter(log => log.timestamp && new Date(log.timestamp) >= weekAgo);
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      logs = logs.filter(log => log.timestamp && new Date(log.timestamp) >= monthAgo);
    }

    logs.sort((a, b) => {
      if (!a.timestamp) return 1;
      if (!b.timestamp) return -1;
      return sortOrder === 'asc'
        ? a.timestamp - b.timestamp
        : b.timestamp - a.timestamp;
    });

    return logs;
  }, [allAdminLogs, admin.id, filterType, dateFilter, sortOrder]);

  const uploadLogs = adminLogs.filter(log => log.action === 'UPLOAD_PHOTO');
  const deleteLogs = adminLogs.filter(log => log.action === 'DELETE_PHOTO');

  const uploadedStudents = useMemo(() => {
    const students = allStudents.filter(student => {
      // Find students who have an upload log from this admin
      // Note: This logic assumes current photo was uploaded by this admin if a log exists
      // A more robust check would verify the log timestamp matches close to last modified, but this suffices for simple tracking
      return adminLogs.some(log => log.studentId === student.id && log.action === 'UPLOAD_PHOTO');
    });
    return students;
  }, [allStudents, adminLogs]);

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString('km-KH');
  };

  const toggleUserSelection = (studentId) => {
    const newSelection = new Set(selectedUsers);
    if (newSelection.has(studentId)) {
      newSelection.delete(studentId);
    } else {
      newSelection.add(studentId);
    }
    setSelectedUsers(newSelection);
    setShowBatchActions(newSelection.size > 0);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      <div className="bg-white w-full max-w-4xl rounded-2xl p-5 shadow-2xl relative z-10 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-slate-800">{admin.name}</h3>
          <button onClick={onClose} className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center hover:bg-slate-200 transition-colors">
            <X className="h-4 w-4 text-slate-600" />
          </button>
        </div>

        <div className="bg-slate-50 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center">
              <User className="h-6 w-6 text-indigo-600" />
            </div>
            <div className="flex-1">
              
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white rounded p-2">
                 <div className="text-xs text-slate-500">Uploads</div>
                 <div className="font-bold text-indigo-600">{uploadLogs.length}</div>
              </div>
              <div className="bg-white rounded p-2">
                 <div className="text-xs text-slate-500">Deletes</div>
                 <div className="font-bold text-red-500">{deleteLogs.length}</div>
              </div>
              <div className="bg-white rounded p-2">
                 <div className="text-xs text-slate-500">Users</div>
                 <div className="font-bold text-green-600">{uploadedStudents.length}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-200 mb-4">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${activeTab === 'users' ? 'text-indigo-600 border-indigo-600' : 'text-slate-500 border-transparent hover:text-slate-700'}`}
          >
            Users ({uploadedStudents.length})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${activeTab === 'logs' ? 'text-indigo-600 border-indigo-600' : 'text-slate-500 border-transparent hover:text-slate-700'}`}
          >
            Logs ({adminLogs.length})
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
             onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
             className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-xs text-slate-600 hover:bg-slate-200"
          >
             {sortOrder === 'asc' ? <SortAsc className="h-3 w-3"/> : <SortDesc className="h-3 w-3"/>}
             Sort
          </button>
          
          <div className="flex items-center gap-1 bg-slate-100 rounded px-2 py-1">
             <Filter className="h-3 w-3 text-slate-500"/>
             <select 
               className="bg-transparent text-xs text-slate-600 outline-none"
               value={filterType}
               onChange={(e) => setFilterType(e.target.value)}
             >
               <option value="all">All Types</option>
               <option value="upload">Uploads</option>
               <option value="delete">Deletes</option>
             </select>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 rounded px-2 py-1">
             <Clock className="h-3 w-3 text-slate-500"/>
             <select 
               className="bg-transparent text-xs text-slate-600 outline-none"
               value={dateFilter}
               onChange={(e) => setDateFilter(e.target.value)}
             >
               <option value="all">Any Time</option>
               <option value="today">Today</option>
               <option value="week">This Week</option>
               <option value="month">This Month</option>
             </select>
          </div>
          
          {activeTab === 'users' && (
             <div className="ml-auto flex gap-1">
                <button onClick={() => setUserViewMode('grid')} className={`p-1 rounded ${userViewMode === 'grid' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400'}`}><Grid3X3 className="h-4 w-4"/></button>
                <button onClick={() => setUserViewMode('list')} className={`p-1 rounded ${userViewMode === 'list' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400'}`}><List className="h-4 w-4"/></button>
             </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
           {activeTab === 'users' ? (
              userViewMode === 'grid' ? (
                 <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {uploadedStudents.map(student => (
                       <div key={student.id} className="relative group border rounded-lg overflow-hidden bg-slate-50">
                          <div className="aspect-[4/5] relative">
                             {student['រូបថត'] ? (
                                <img src={student['រូបថត']} className="w-full h-full object-cover" />
                             ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-300"><User className="h-8 w-8"/></div>
                             )}
                             <button onClick={() => onDeletePhoto(student.id)} className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 className="h-3 w-3" />
                             </button>
                          </div>
                          <div className="p-2">
                             <div className="text-xs font-bold truncate">{student['ឈ្មោះ']}</div>
                             <div className="text-[10px] text-slate-500">{student.id}</div>
                          </div>
                       </div>
                    ))}
                 </div>
              ) : (
                 <div className="space-y-2">
                    {uploadedStudents.map(student => (
                       <div key={student.id} className="flex items-center gap-3 p-2 border rounded-lg hover:bg-slate-50">
                          <div className="w-10 h-10 bg-slate-200 rounded overflow-hidden">
                             {student['រូបថត'] && <img src={student['រូបថត']} className="w-full h-full object-cover"/>}
                          </div>
                          <div className="flex-1">
                             <div className="text-sm font-bold">{student['ឈ្មោះ']}</div>
                             <div className="text-xs text-slate-500">{student.id}</div>
                          </div>
                          <button onClick={() => onDeletePhoto(student.id)} className="text-red-500 p-2 hover:bg-red-50 rounded-full">
                             <Trash2 className="h-4 w-4"/>
                          </button>
                       </div>
                    ))}
                 </div>
              )
           ) : (
              <div className="space-y-2">
                 {adminLogs.map(log => {
                    const student = allStudents.find(s => s.id === log.studentId);
                    return (
                       <div key={log.id} className="p-3 border rounded-lg flex items-center gap-3">
                          <div className={`p-2 rounded-full ${log.action === 'UPLOAD_PHOTO' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                             {log.action === 'UPLOAD_PHOTO' ? <Camera className="h-4 w-4"/> : <Trash2 className="h-4 w-4"/>}
                          </div>
                          <div className="flex-1">
                             <div className="text-sm font-medium">
                                {log.action === 'UPLOAD_PHOTO' ? 'Uploaded photo for' : 'Deleted photo of'} 
                                <span className="font-bold ml-1">{student ? student['ឈ្មោះ'] : log.studentId}</span>
                             </div>
                             <div className="text-xs text-slate-500">{formatTimestamp(log.timestamp)}</div>
                          </div>
                       </div>
                    )
                 })}
                 {adminLogs.length === 0 && (
                    <div className="text-center py-8 text-slate-400">No logs found for this period</div>
                 )}
              </div>
           )}
        </div>
      </div>
    </div>
  );
};

// --- Custom Alert/Confirm UI ---
const AlertToast = ({ isOpen, message, type }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed top-0 left-0 w-full h-full pointer-events-none flex items-start justify-center pt-6 z-[100]">
      <div className={`pointer-events-auto bg-white/95 backdrop-blur-md px-4 py-3 rounded-full shadow-2xl flex items-center gap-2 animate-in slide-in-from-top duration-300 border-l-4 ${type === 'error' ? 'border-red-500 text-red-600' : 'border-green-500 text-green-700'
        }`}>
        {type === 'error' ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
        <span className="font-bold text-xs shadow-sm">{message}</span>
      </div>
    </div>
  );
};

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onCancel}></div>
      <div className="bg-white w-full max-w-xs rounded-2xl p-5 shadow-2xl relative z-10 animate-in fade-in zoom-in duration-200 text-center">
        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3 text-red-500">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-2">{title}</h3>
        <p className="text-slate-500 text-sm mb-5 leading-relaxed">{message}</p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition-colors"
          >
            បោះបង់
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 shadow-lg shadow-red-200 transition-colors"
          >
            បញ្ជាក់
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Bottom Navigation ---
const BottomNav = ({ activeTab, onChange, pendingCount }) => {
  const tabs = [
    { id: 'home', icon: Search, label: 'ស្វែងរក' },
    { id: 'pending', icon: ImageOff, label: 'ខ្វះ', badge: pendingCount },
    { id: 'delete', icon: Trash2, label: 'លុប' },
    { id: 'admin', icon: User, label: 'Admin' }
  ];
  return (
    <nav className="bg-white/90 backdrop-blur-md fixed bottom-0 w-full pb-safe z-40 border-t border-slate-200 shadow-[0_-5px_10px_rgba(0,0,0,0.02)]">
      <div className="flex justify-around items-center h-16 px-2">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`relative flex flex-col items-center justify-center w-full h-full transition-all duration-300 ${isActive ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                }`}
            >
              <div className={`p-1.5 rounded-xl transition-all duration-300 ${isActive ? 'bg-indigo-50 -translate-y-1' : ''
                }`}>
                <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
              </div>
              <span className={`text-[9px] font-bold mt-0.5 ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                } transition-all absolute bottom-1`}>
                {tab.label}
              </span>
              {tab.badge > 0 && (
                <span className="absolute top-2 right-1/4 min-w-[16px] h-[16px] bg-red-500 text-white text-[9px] font-bold flex items-center justify-center rounded-full border border-white shadow-sm animate-pulse">
                  {tab.badge > 99 ? '99+' : tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
}
