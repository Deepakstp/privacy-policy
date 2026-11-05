/**
 * =========================================================================================
 * Salary Book — Native Google Drive JSON Server & Multi-Tenant Auth Backend
 * (100% Free - No Google Sheets Required. Pure Google Drive JSON Read/Write Engine)
 * =========================================================================================
 */

const ROOT_FOLDER_NAME = "SalaryBook_DriveServer_Data";

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || "ping";
    
    // 1. Connection Ping
    if (action === "ping") {
      return jsonResponse({ status: "success", message: "Google Drive JSON Server is Online", version: "4.2" });
    }

    // 2. Server-side Version Check & In-App Auto-Update Metadata
    if (action === "checkVersion") {
      return jsonResponse({
        status: "success",
        latestVersionCode: 10,                 // वर्ज़न कोड (नया अपडेट भेजने के लिए यहाँ संख्या बढ़ा दें)
        latestVersionName: "1.0.1",            // वर्ज़न नाम
        forceUpdate: false,                    // true करने पर यूज़र को अपडेट करना अनिवार्य होगा
        downloadUrl: "https://github.com/diagnolite/salary-book/releases/download/v1.0.1/SalaryBook.apk", // आपके APK का डायरेक्ट डाउनलोड लिंक
        releaseNotes: "✨ नए फीचर्स और ऑटो-मैजिक अपडेट सुधार के साथ।"
      });
    }

    const companyId = (e.parameter && e.parameter.companyId) || "default_company";
    const tenantFolder = getTenantFolder(companyId);

    // 3. Strict Multi-Tenant ID / Whitelist Authentication
    if (action === "authenticate") {
      const email = (e.parameter && e.parameter.email) || "";
      const usersData = readJsonFile(tenantFolder, "users.json") || getDefaultUsers(companyId);
      
      const foundUser = usersData.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (foundUser) {
        if (foundUser.status === "disabled") {
          return jsonResponse({ status: "error", message: "User account is disabled." });
        }
        return jsonResponse({ status: "success", user: foundUser });
      }
      return jsonResponse({ status: "error", message: "❌ आपकी आईडी इस कंपनी में अधिकृत (Whitelisted) नहीं है।" });
    }

    // 4. Get Monthly JSON Payroll File from Drive
    if (action === "getPayroll") {
      const monthKey = (e.parameter && e.parameter.monthKey) || getCurrentMonthKey();
      const payrollData = readJsonFile(tenantFolder, `payroll_${monthKey}.json`) || { employees: [], attendance: [], entries: [] };
      return jsonResponse({ status: "success", monthKey: monthKey, data: payrollData });
    }

    return jsonResponse({ status: "error", message: "Unknown GET action." });

  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  }
}

function doPost(e) {
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else {
      payload = e.parameter || {};
    }

    const action = payload.action;
    const companyId = payload.companyId || "default_company";
    const tenantFolder = getTenantFolder(companyId);

    // 1. Initialize Tenant (First-time Setup)
    if (action === "initTenant") {
      const adminEmail = payload.adminEmail || "admin@company.com";
      const adminName = payload.adminName || "Company Admin";
      
      let users = readJsonFile(tenantFolder, "users.json");
      if (!users) {
        users = [
          { email: adminEmail, name: adminName, role: "admin", status: "active", isOwner: true },
          { email: "employee@company.com", name: "Sample Employee", role: "employee", status: "active", isOwner: false }
        ];
        writeJsonFile(tenantFolder, "users.json", users);
      }
      return jsonResponse({ status: "success", message: "Tenant initialized successfully on Google Drive." });
    }

    // 2. Save Monthly JSON Payroll File to Drive
    if (action === "savePayroll") {
      const monthKey = payload.monthKey || getCurrentMonthKey();
      const payrollData = payload.data || {};
      writeJsonFile(tenantFolder, `payroll_${monthKey}.json`, payrollData);
      return jsonResponse({ status: "success", message: `Payroll JSON saved for ${monthKey}` });
    }

    return jsonResponse({ status: "error", message: "Unknown POST action." });

  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  }
}

// =========================================================================
// DRIVE STORAGE HELPER FUNCTIONS (JSON Read/Write)
// =========================================================================

function getTenantFolder(companyId) {
  const folders = DriveApp.getFoldersByName(ROOT_FOLDER_NAME);
  const root = folders.hasNext() ? folders.next() : DriveApp.createFolder(ROOT_FOLDER_NAME);
  
  const tenantFolders = root.getFoldersByName(companyId);
  return tenantFolders.hasNext() ? tenantFolders.next() : root.createFolder(companyId);
}

function readJsonFile(folder, fileName) {
  const files = folder.getFilesByName(fileName);
  if (files.hasNext()) {
    const file = files.next();
    try {
      return JSON.parse(file.getBlob().getDataAsString());
    } catch (e) {
      return null;
    }
  }
  return null;
}

function writeJsonFile(folder, fileName, dataObj) {
  const files = folder.getFilesByName(fileName);
  const content = JSON.stringify(dataObj, null, 2);
  if (files.hasNext()) {
    files.next().setContent(content);
  } else {
    folder.createFile(fileName, content, MimeType.JSON);
  }
}

function getDefaultUsers(companyId) {
  return [
    { email: "diagnolite@gmail.com", name: "Admin Owner", role: "admin", status: "active", isOwner: true }
  ];
}

function getCurrentMonthKey() {
  return Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM");
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
