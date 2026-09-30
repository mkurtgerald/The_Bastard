; Per-user, unsigned generated-fixture evaluation. No service/PATH/security changes.
#define SourceRoot "..\..\dist\TheBastard-OriginalUI-Evaluation"
[Setup]
AppId={{0E28A5A2-0D6E-4D1A-A97E-B2F6EE8E9355}
AppName=The Bastard Original UI Evaluation
AppVersion=0.1.0
AppPublisher=The Bastard project
DefaultDirName={localappdata}\Programs\TheBastardEvaluation
DefaultGroupName=The Bastard Evaluation
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
DisableProgramGroupPage=yes
OutputDir=..\..\dist
OutputBaseFilename=TheBastard-OriginalUI-Evaluation-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
CloseApplications=no
RestartApplications=no
UninstallDisplayName=The Bastard Original UI Evaluation
InfoBeforeFile=..\EVALUATION.md

[Files]
Source: "{#SourceRoot}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{userprograms}\The Bastard Evaluation\Original UI Evaluation"; Filename: "{app}\START-EVALUATION.cmd"; WorkingDir: "{app}"
Name: "{userdesktop}\The Bastard Evaluation"; Filename: "{app}\START-EVALUATION.cmd"; WorkingDir: "{app}"

[Run]
Filename: "{app}\START-EVALUATION.cmd"; Description: "Start the generated-fixture evaluation"; Flags: shellexec postinstall skipifsilent unchecked
