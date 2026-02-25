# Product Quotation System v2.3.8 Preview

## 概述
这是一个用于产品报价计算的Electron桌面应用程序。系统支持多种产品的报价计算，包括标准和定制包装模式。

## 主要功能
- 产品搜索和选择
- 动态报价计算
- PDF导出功能
- 产品管理（管理员界面）
- 支持多种货币和汇率

## 系统要求
- Windows 10或更高版本
- 无需额外安装，直接运行可执行文件

## 安装和运行
1. 下载 `release/1.0.0/win-unpacked/` 目录中的所有文件
2. 运行 `YourAppName.exe` 启动应用程序

## 界面说明
- **Quoter**: 主要报价界面，支持产品选择和参数输入
- **Admin**: 产品管理界面，用于添加、编辑和删除产品

## 技术栈
- Electron + React + TypeScript
- 简化版UI（移除了复杂组件库）
- LowDB数据持久化
- jsPDF PDF导出

## 已知问题
- UI使用内联样式（为简化界面故意为之）
- 仅支持Windows平台

## 版本历史
- v2.3.8: Current release
