; Inno Setup Script for Industrial IoT Monitor Platform
; See https://jrsoftware.org/ishelp/ for details.

#define AppName "IoT Monitor"
#define AppVersion "1.0.0"
#define AppPublisher "Antigravity IoT"
#define AppURL "http://localhost:8080"
#define AppExeName "backend.exe"
#define AppServiceExeName "backend_service.exe"

[Setup]
AppId={{9F57BA48-A8A1-4F2E-99F5-C3660505A0C2}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
AppUpdatesURL={#AppURL}
DefaultDirName={commonpf}\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
OutputBaseFilename=IoTMonitorSetup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Directories]
Name: "C:\ProgramData\IoTMonitor"
Name: "C:\ProgramData\IoTMonitor\config"
Name: "C:\ProgramData\IoTMonitor\data"
Name: "C:\ProgramData\IoTMonitor\logs"
Name: "C:\ProgramData\IoTMonitor\backups"

[Files]
; PyInstaller compiled output (backend.exe, backend_service.exe, _internal\)
Source: "backend\dist\IoTMonitor\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs

; Mosquitto MQTT broker binaries and DLLs
Source: "mosquitto\*"; DestDir: "{app}\mosquitto"; Flags: recursesubdirs createallsubdirs ignoreversion

; Reference copies of default config in install directory
Source: "mosquitto\mosquitto.conf"; DestDir: "{app}\default_config"; Flags: ignoreversion
Source: "backend\app\core\settings.template.json"; DestDir: "{app}\default_config"; DestName: "settings.json"; Flags: ignoreversion

; Write config files to ProgramData ONLY if they do not exist yet (preserves user edits on upgrade)
Source: "mosquitto\mosquitto.conf"; DestDir: "C:\ProgramData\IoTMonitor\config"; Flags: onlyifdoesntexist
Source: "backend\app\core\settings.template.json"; DestDir: "C:\ProgramData\IoTMonitor\config"; DestName: "settings.json"; Flags: onlyifdoesntexist

Source: "version.json"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExeName}"
Name: "{group}\Uninstall {#AppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExeName}"

[Run]
; 1. Stop & disable any pre-existing system Mosquitto service to free port 1883
;    (nowait + runhidden: non-zero exit code silently ignored)
Filename: "{sys}\net.exe"; Parameters: "stop mosquitto"; Flags: runhidden nowait; StatusMsg: "Clearing existing MQTT service..."
Filename: "{sys}\sc.exe"; Parameters: "config mosquitto start= disabled"; Flags: runhidden

; 2. Start services — nowait prevents installer from blocking if startup is slow
Filename: "{sys}\net.exe"; Parameters: "start IoTMonitorMQTT"; Flags: runhidden nowait; StatusMsg: "Starting MQTT Broker..."
Filename: "{sys}\net.exe"; Parameters: "start IoTMonitorBackend"; Flags: runhidden nowait; StatusMsg: "Starting IoT Monitor Backend..."

; 3. Open dashboard in the default browser (optional, shown on final wizard page)
Filename: "http://localhost:8080"; Flags: shellexec runasoriginaluser postinstall; Description: "Launch IoT Monitor Dashboard now"

[UninstallRun]
; Stop services before files are removed
Filename: "{sys}\net.exe"; Parameters: "stop IoTMonitorBackend"; Flags: runhidden nowait; RunOnceId: "StopBackend"
Filename: "{sys}\net.exe"; Parameters: "stop IoTMonitorMQTT"; Flags: runhidden nowait; RunOnceId: "StopMQTT"

[Code]

// ============================================================
// InitializeSetup — backup database before upgrade overwrites
// ============================================================
function InitializeSetup(): Boolean;
begin
  Result := True;
  if FileExists('C:\ProgramData\IoTMonitor\data\iot_monitor.db') then
  begin
    CreateDir('C:\ProgramData\IoTMonitor\backups');
    CopyFile(
      'C:\ProgramData\IoTMonitor\data\iot_monitor.db',
      'C:\ProgramData\IoTMonitor\backups\pre_upgrade_backup.db',
      False
    );
  end;
end;

// ============================================================
// CurStepChanged(ssPostInstall)
//
// Runs AFTER all files are extracted, BEFORE [Run] entries.
// We register both Windows services here using sc.exe so that
// Pascal string concatenation produces correctly-quoted binPath
// values — avoiding Inno Setup's limited quoting for paths with
// spaces (C:\Program Files\...).
//
// Backend binPath:  "{app}\backend_service.exe"
//   No embedded args, just the exe path quoted.
//   SCM calls it with no extra argv → len(sys.argv)==1 →
//   enters servicemanager.StartServiceCtrlDispatcher() branch.
//
// Mosquitto binPath: "\"<app>\mosquitto\mosquitto.exe\" -c <conf>"
//   Exe path is escaped with \" so SCM correctly parses the
//   space-containing path from the -c argument.
// ============================================================
procedure CurStepChanged(CurStep: TSetupStep);
var
  AppDir, SysDir: string;
  BinPath, Params: string;
  ResultCode: Integer;
begin
  if CurStep = ssPostInstall then
  begin
    AppDir := ExpandConstant('{app}');
    SysDir  := ExpandConstant('{sys}');

    // ----------------------------------------------------------
    // Backend Windows Service
    // ----------------------------------------------------------
    // Remove stale service from any previous install (ignore errors)
    Exec(SysDir + '\sc.exe', 'delete IoTMonitorBackend',
         '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

    // binPath= "C:\Program Files\IoT Monitor\backend_service.exe"
    BinPath := '"' + AppDir + '\backend_service.exe"';
    Params  := 'create IoTMonitorBackend binPath= ' + BinPath +
               ' start= auto DisplayName= "IoT Monitor Backend"';
    Exec(SysDir + '\sc.exe', Params, '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

    // Description
    Exec(SysDir + '\sc.exe',
         'description IoTMonitorBackend "FastAPI uvicorn backend for IoT Monitor dashboard"',
         '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

    // Auto-restart on failure
    Exec(SysDir + '\sc.exe',
         'failure IoTMonitorBackend reset= 86400 actions= restart/5000/restart/5000/restart/5000',
         '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

    // ----------------------------------------------------------
    // Mosquitto MQTT Broker Windows Service
    // ----------------------------------------------------------
    // Remove stale service from any previous install (ignore errors)
    Exec(SysDir + '\sc.exe', 'delete IoTMonitorMQTT',
         '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

    // Build binPath with escaped inner quotes so SCM parses the
    // space-containing exe path separately from the -c argument:
    //   "\"C:\Program Files\IoT Monitor\mosquitto\mosquitto.exe\" -c C:\ProgramData\..."
    BinPath := '\"' + AppDir + '\mosquitto\mosquitto.exe\"' +
               ' -c C:\ProgramData\IoTMonitor\config\mosquitto.conf';
    Params  := 'create IoTMonitorMQTT binPath= "' + BinPath + '"' +
               ' start= auto DisplayName= "IoT Monitor MQTT Broker"';
    Exec(SysDir + '\sc.exe', Params, '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

    // Description
    Exec(SysDir + '\sc.exe',
         'description IoTMonitorMQTT "Mosquitto MQTT broker for IoT Monitor device telemetry"',
         '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

    // Auto-restart on failure
    Exec(SysDir + '\sc.exe',
         'failure IoTMonitorMQTT reset= 86400 actions= restart/5000/restart/5000/restart/5000',
         '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;
end;

// ============================================================
// CurUninstallStepChanged — clean up services on uninstall
// ============================================================
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  AppDir, SysDir: string;
  ResultCode: Integer;
begin
  if CurUninstallStep = usUninstall then
  begin
    AppDir := ExpandConstant('{app}');
    SysDir  := ExpandConstant('{sys}');

    // Unregister backend service using the service wrapper's remove command
    Exec(AppDir + '\backend_service.exe', 'remove',
         '', SW_HIDE, ewWaitUntilTerminated, ResultCode);

    // Delete MQTT service entry from SCM
    Exec(SysDir + '\sc.exe', 'delete IoTMonitorMQTT',
         '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  end;
end;
