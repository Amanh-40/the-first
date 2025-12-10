 class AttendanceSystem {
  constructor() {
    this.studentsData = {};
    this.absenceRecords = this.loadFromLocalStorage("absenceRecords") || {};
    this.counselingList = this.loadFromLocalStorage("counselingList") || {};
    this.lastCleanDate = this.loadFromLocalStorage("lastCleanDate") || "";

    // Sheet names with "copy of"
    this.classNames = {
      class1: "copy of اول ثانوي أ",
      class2: "copy of اول ثانوي ب",
      class3: "copy of اول ثانوي ج",
      class4: "copy of ثاني ثانوي أ",
      class5: "copy of ثاني ثانوي ب",
      class6: "copy of ثالث ثانوي أ",
      class7: "copy of ثالث ثانوي ب"
    };

    this.SPREADSHEET_ID = "1rwtmsRE5W0jhxk2XYgOhZpz4PW6v_tOMKaNXBdHeqQU";
    this.API_KEY = "AIzaSyBJlzAoARavcooShg3eId9FSHEXfnmpfTk";

    this.init();
  }

  init() {
    this.bindEvents();
    this.loadClasses();
    this.showPage("absence");
    this.startAutoClean(); // Start the auto-clean system
    this.cleanOldData(); // Clean any old data on startup
  }

  bindEvents() {
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const page = e.target.getAttribute("data-page");
        this.showPage(page);
      });
    });

    const classSelect = document.getElementById("classSelect");
    const absenceForm = document.getElementById("absenceForm");
    const resetBtn = document.getElementById("resetBtn");

    if (classSelect) {
      classSelect.addEventListener("change", (e) =>
        this.loadStudents(e.target.value)
      );
    }

    if (absenceForm) {
      absenceForm.addEventListener("submit", (e) => this.handleSubmit(e));
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", () => this.resetForm());
    }
  }

  showPage(pageName) {
    document.querySelectorAll(".page").forEach((page) => {
      page.classList.remove("active");
    });

    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.classList.remove("active");
    });

    document.getElementById(`${pageName}-page`).classList.add("active");
    document.querySelector(`[data-page="${pageName}"]`).classList.add("active");

    if (pageName === "admin") {
      this.loadAdminDashboard();
    } else if (pageName === "counseling") {
      this.loadCounselingDashboard();
    }
  }

  // IMPROVED: Auto-clean system - clears absence records daily at midnight
  startAutoClean() {
    const checkAndClean = () => {
      const now = new Date();
      const today = now.toDateString();

      // Check if we haven't cleaned today yet
      if (this.lastCleanDate !== today) {
        const hours = now.getHours();

        // Check if it's after midnight (12:00 AM to 1:00 AM)
        if (hours === 0) {
          console.log("🕛 منتصف الليل - تنظيف سجل الغياب...");
          this.cleanDailyAbsenceData();
        }
      }
    };

    // Check every minute
    setInterval(checkAndClean, 60000);

    // Also check immediately when app starts
    checkAndClean();
  }

  // NEW: Clean daily absence data (keeps counseling list)
  cleanDailyAbsenceData() {
    const today = new Date().toDateString();

    // Clear all absence records but keep counseling list
    this.absenceRecords = {};
    this.lastCleanDate = today;

    this.saveToLocalStorage("absenceRecords", this.absenceRecords);
    this.saveToLocalStorage("lastCleanDate", this.lastCleanDate);

    console.log("✅ تم تنظيف سجل الغياب اليومي تلقائياً");

    // Show notification
    this.showAutoCleanNotification();

    // Reload admin dashboard if it's open
    if (document.getElementById("admin-page").classList.contains("active")) {
      this.loadAdminDashboard();
    }
  }

  // NEW: Clean any old data on app startup
  cleanOldData() {
    const today = new Date().toDateString();
    if (this.lastCleanDate !== today) {
      console.log("🔄 تنظيف البيانات القديمة...");
      this.cleanDailyAbsenceData();
    }
  }

  // NEW: Show notification when auto-clean happens
  showAutoCleanNotification() {
    // Create notification element
    const notification = document.createElement("div");
    notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #d4edda;
            color: #155724;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #c3e6cb;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            font-weight: bold;
        `;
    notification.innerHTML = "🔄 تم تنظيف سجل الغياب تلقائياً للبدء بيوم جديد";

    document.body.appendChild(notification);

    // Remove after 5 seconds
    setTimeout(() => {
      notification.remove();
    }, 5000);
  }

  async loadClasses() {
    console.log("🔄 Starting to load classes from Google Sheets...");
    console.log('📊 Using sheet names with "copy of" prefix');

    for (const classId in this.classNames) {
      await this.loadStudentsFromSheet(classId);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  async loadStudentsFromSheet(classId) {
    const className = this.classNames[classId];

    try {
      const range = `${className}!B:B`;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${
        this.SPREADSHEET_ID
      }/values/${encodeURIComponent(range)}?key=${this.API_KEY}`;

      console.log(`📡 Fetching from: ${className}`);

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.values && data.values.length > 0) {
        const students = data.values
          .flat()
          .filter((name) => name && name.toString().trim() !== "")
          .filter((name) => !name.toString().includes("اسم الطالب"));

        this.studentsData[classId] = students;
        console.log(
          `✅ SUCCESS: Loaded ${students.length} students from "${className}"`
        );
      } else {
        console.warn(`⚠️ No data found in "${className}"`);
        this.studentsData[classId] = [];
      }
    } catch (error) {
      console.error(`❌ ERROR loading "${className}":`, error);
      this.studentsData[classId] = [];
    }
  }

  async loadStudents(classId) {
    const studentsList = document.getElementById("studentsList");
    const formTitle = document.getElementById("formTitle");

    if (!classId) {
      studentsList.innerHTML = "";
      return;
    }

    studentsList.innerHTML =
      '<div class="loading">🔄 جاري تحميل البيانات...</div>';

    const students = this.studentsData[classId] || [];

    // Display name without "copy of" for better UX
    const displayName = this.classNames[classId].replace("copy of ", "");

    if (students.length === 0) {
      studentsList.innerHTML = `
                <div style="background: #fff3cd; color: #856404; padding: 15px; border-radius: 5px; text-align: center;">
                    ⚠️ جاري تحميل البيانات من "${this.classNames[classId]}"<br>
                </div>
            `;
      return;
    }

    formTitle.textContent = `نموذج غياب - ${displayName}`;

    studentsList.innerHTML = students
      .map(
        (student) => `
            <div class="student-item">
                <input type="checkbox" id="${classId}_${student}" name="absentStudents" value="${student}">
                <label for="${classId}_${student}">${student}</label>
            </div>
        `
      )
      .join("");
  }

  handleSubmit(e) {
    e.preventDefault();

    const classSelect = document.getElementById("classSelect");
    const classId = classSelect.value;

    if (!classId) {
      this.showMessage("يرجى اختيار الفصل أولاً", "error");
      return;
    }

    const selectedStudents = Array.from(
      document.querySelectorAll('input[name="absentStudents"]:checked')
    ).map((checkbox) => checkbox.value);

    if (selectedStudents.length === 0) {
      this.showMessage("يرجى اختيار طالب واحد على الأقل", "error");
      return;
    }

    this.recordAbsence(classId, selectedStudents);

    // Show success message in light green card
    this.showSuccessMessage();
  }

  // Show success message after recording absence
  showSuccessMessage() {
    const successCard = document.createElement("div");
    successCard.className = "success-message-card";
    successCard.innerHTML = `
            <div style="background: #d4edda; color: #155724; padding: 15px; border-radius: 8px; border: 1px solid #c3e6cb; margin: 15px 0; text-align: center; font-weight: bold;">
                ✅ تم تسجيل الغياب بنجاح
            </div>
        `;

    // Insert after the form
    const form = document.getElementById("absenceForm");
    form.parentNode.insertBefore(successCard, form.nextSibling);

    // Remove the message after 5 seconds
    setTimeout(() => {
      successCard.remove();
    }, 5000);
  }

  recordAbsence(classId, students) {
    const today = new Date().toISOString().split("T")[0];
    const monthKey = new Date().toISOString().slice(0, 7);

    if (!this.absenceRecords[classId]) {
      this.absenceRecords[classId] = {};
    }

    if (!this.absenceRecords[classId][monthKey]) {
      this.absenceRecords[classId][monthKey] = {};
    }

    students.forEach((student) => {
      if (!this.absenceRecords[classId][monthKey][student]) {
        this.absenceRecords[classId][monthKey][student] = [];
      }

      if (!this.absenceRecords[classId][monthKey][student].includes(today)) {
        this.absenceRecords[classId][monthKey][student].push(today);

        if (this.absenceRecords[classId][monthKey][student].length >= 5) {
          this.addToCounselingList(
            classId,
            student,
            this.absenceRecords[classId][monthKey][student].length
          );
        }
      }
    });

    this.saveToLocalStorage("absenceRecords", this.absenceRecords);
    this.resetForm();
  }

  addToCounselingList(classId, studentName, absenceCount) {
    if (!this.counselingList[classId]) {
      this.counselingList[classId] = {};
    }

    this.counselingList[classId][studentName] = {
      absenceCount: absenceCount,
      dateAdded: new Date().toISOString(),
      class: this.classNames[classId].replace("copy of ", "")
    };

    this.saveToLocalStorage("counselingList", this.counselingList);
  }

  getClassDisplayName(classId) {
    return this.classNames[classId].replace("copy of ", "");
  }

  resetForm() {
    document.getElementById("absenceForm").reset();
    const message = document.getElementById("message");
    message.style.display = "none";
  }

  showMessage(text, type) {
    const message = document.getElementById("message");
    message.textContent = text;
    message.className = `message ${type}`;
    message.style.display = "block";

    setTimeout(() => {
      message.style.display = "none";
    }, 5000);
  }

  loadAdminDashboard() {
    this.updateAdminStats();
    this.displayAbsenceRecords();
  }

  loadCounselingDashboard() {
    this.displayCounselingList();
  }

  updateAdminStats() {
    let totalAbsences = 0;
    let studentsWithAbsences = 0;

    Object.values(this.absenceRecords).forEach((classData) => {
      Object.values(classData).forEach((monthData) => {
        Object.values(monthData).forEach((absences) => {
          totalAbsences += absences.length;
          studentsWithAbsences++;
        });
      });
    });

    // Count students in counseling list
    let counselingCount = 0;
    Object.values(this.counselingList).forEach((classData) => {
      counselingCount += Object.keys(classData).length;
    });

    // Count unique absent students for today only
    const today = new Date().toISOString().split("T")[0];
    let todayAbsentStudents = 0;

    Object.values(this.absenceRecords).forEach((classData) => {
      Object.values(classData).forEach((monthData) => {
        Object.values(monthData).forEach((absences) => {
          if (absences.includes(today)) {
            todayAbsentStudents++;
          }
        });
      });
    });

    const statsContainer = document.querySelector(".stats");
    if (statsContainer) {
      statsContainer.innerHTML = `
                <div class="stat-card">
                    <div class="stat-number">${counselingCount}</div>
                    <div class="stat-label">طالب يحتاج متابعة</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${totalAbsences}</div>
                    <div class="stat-label">غياب إجمالي</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${todayAbsentStudents}</div>
                    <div class="stat-label">طالب متغيب اليوم</div>
                </div>
            `;
    }
  }

  displayAbsenceRecords() {
    const dashboard = document.getElementById("adminDashboard");
    if (!dashboard) return;

    // Check if there's any data to display
    const hasData = Object.keys(this.absenceRecords).some((classId) => {
      const classData = this.absenceRecords[classId];
      return Object.keys(classData).some((monthKey) => {
        const monthData = classData[monthKey];
        return Object.keys(monthData).length > 0;
      });
    });

    if (!hasData) {
      dashboard.innerHTML = `
                <div style="text-align: center; padding: 40px; background: #f8f9fa; border-radius: 8px; color: #6c757d;">
                    📊 لا توجد غيابات مسجلة لهذا اليوم
                    <br>
                    <small>سيتم تنظيف السجل تلقائياً عند منتصف الليل</small>
                </div>
            `;
      return;
    }

    let html = "";

    Object.keys(this.absenceRecords).forEach((classId) => {
      const classData = this.absenceRecords[classId];
      const className = this.classNames[classId].replace("copy of ", "");

      let classHtml = `
                <div class="class-card">
                    <h3>${className}</h3>
                    <ul class="absent-list">
            `;

      let hasAbsences = false;

      Object.keys(classData).forEach((monthKey) => {
        const monthData = classData[monthKey];

        Object.keys(monthData).forEach((student) => {
          const absences = monthData[student];
          if (absences.length > 0) {
            hasAbsences = true;
            const lastAbsence = absences[absences.length - 1];
            classHtml += `
                            <li>
                                <div class="student-info">
                                    <span>${student}</span>
                                    <span class="absence-count">${
                                      absences.length
                                    } غياب</span>
                                </div>
                                <small>آخر غياب: ${this.formatDate(
                                  lastAbsence
                                )}</small>
                            </li>
                        `;
          }
        });
      });

      if (!hasAbsences) {
        classHtml += "<li>لا توجد غيابات مسجلة لهذا اليوم</li>";
      }

      classHtml += "</ul></div>";
      html += classHtml;
    });

    dashboard.innerHTML = html;
  }

  displayCounselingList() {
    const counselingContainer = document.getElementById("counselingList");
    if (!counselingContainer) return;

    let counselingCount = 0;
    let counselingHtml = "";

    Object.keys(this.counselingList).forEach((classId) => {
      const classData = this.counselingList[classId];

      Object.keys(classData).forEach((student) => {
        counselingCount++;
        const data = classData[student];
        counselingHtml += `
                    <li>
                        <div class="student-info">
                            <strong>${student}</strong>
                            <span class="absence-count">${
                              data.absenceCount
                            } غياب</span>
                        </div>
                        <div>${data.class}</div>
                        <small>تم الإضافة: ${this.formatDate(
                          data.dateAdded
                        )}</small>
                    </li>
                `;
      });
    });

    if (counselingCount === 0) {
      counselingContainer.innerHTML =
        '<div class="loading">لا توجد حالات تحتاج متابعة</div>';
      return;
    }

    counselingContainer.innerHTML = counselingHtml;
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString("ar-SA");
  }

  saveToLocalStorage(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error("Error saving to localStorage:", error);
    }
  }

  loadFromLocalStorage(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error("Error loading from localStorage:", error);
      return null;
    }
  }
}

// Initialize the system
document.addEventListener("DOMContentLoaded", () => {
  window.attendanceSystem = new AttendanceSystem();
});
