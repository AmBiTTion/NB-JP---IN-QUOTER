Set shell = CreateObject("WScript.Shell")
projectDir = "D:\MyQuater\. --template vue"
cmd = "cmd /c ""cd /d """"" & projectDir & """"" && call run.bat"""
shell.Run cmd, 0, False
