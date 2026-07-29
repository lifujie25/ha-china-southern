# 南方电网用电统计与日历

[![HACS](https://img.shields.io/badge/HACS-自定义仓库-41BDF5.svg)](https://www.hacs.xyz/)
[![发布版本](https://img.shields.io/github/v/release/lifujie25/ha-china-southern)](https://github.com/lifujie25/ha-china-southern/releases)
[![Validate](https://github.com/lifujie25/ha-china-southern/actions/workflows/validate.yml/badge.svg)](https://github.com/lifujie25/ha-china-southern/actions/workflows/validate.yml)
[![GPL-3.0](https://img.shields.io/github/license/lifujie25/ha-china-southern)](LICENSE)

> 这是 [lifujie25/ha Home Assistant 插件合集](https://github.com/lifujie25/ha) 中的一个独立项目。

面向 Home Assistant 的南方电网自定义集成，适用于广东、广西、云南、贵州、海南。它会读取南网在线中的用电、电费和阶梯信息，并自带一个手机友好的“用电日历”侧边栏。

> 本项目不是南方电网官方产品，依赖其非公开接口。接口调整时可能暂时不可用，请勿把数据作为正式账单结算依据。

## 主要功能

- 支持短信验证码、短信验证码加密码、南网在线/微信/支付宝扫码登录。
- 一个登录账户可添加多个缴费号，也支持添加多个登录账户。
- 提供余额、欠费、阶梯档位、电价、昨日/最近一日用电、本月/上月、今年/去年等传感器。
- 提供本月和上月的每日用电量、电费明细。
- 默认每 4 小时自动更新，可在集成“配置”中调整。
- 安装后自动注册“用电日历”侧边栏，无需复制 JS、添加 Lovelace 资源或编写 YAML。
- 修复 Home Assistant 新版中点击“配置”出现 `500 Internal Server Error` 的问题。

## 最傻瓜的安装方法

### 第一步：在 HACS 添加自定义仓库

1. 打开 **HACS → 集成**。
2. 右上角菜单选择 **自定义存储库**。
3. 存储库填写：

   ```text
   https://github.com/lifujie25/ha-china-southern
   ```

4. 类别选择 **集成**，点击 **添加**。
5. 搜索“南方电网用电统计与日历”，点击 **下载**。
6. 下载完成后重启 Home Assistant。

### 第二步：添加集成

重启后可直接点击：

[![打开 Home Assistant 并添加集成](https://my.home-assistant.io/badges/config_flow_start.svg)](https://my.home-assistant.io/redirect/config_flow_start/?domain=china_southern_power_grid_stat)

也可以手动打开 **设置 → 设备与服务 → 添加集成**，搜索“南方电网用电统计与日历”。

### 第三步：添加缴费号

1. 按提示完成南网账户登录。
2. 在集成卡片上点击 **配置**。
3. 选择 **添加已绑定的缴费号**，再选择要接入的缴费号。
4. 首次数据更新完成后，左侧边栏会自动出现 **用电日历**。

就这些，不需要编辑 `configuration.yaml`。

## 用电日历

日历会自动发现本集成创建的缴费号：

- 多缴费号可在顶部下拉切换。
- 月份可在本月和上月之间切换。
- 显示月累计、日均用电和每天的用电量。
- 颜色按每日用电量分级，手机与桌面页面均可使用。
- 每日数据通常会延迟约 2 天，这是南网数据源本身的更新节奏。

如果日历提示“还没有可显示的缴费号”，请回到集成配置中添加缴费号，并等待第一次更新完成。

## 可用实体

每个缴费号通常会创建以下实体：

- 余额、欠费。
- 当前阶梯档位、阶梯剩余电量、当前阶梯电价。
- 昨日用电量。
- 最近一日用电量与电费。
- 本月累计用电量与电费，以及本月每日明细。
- 上月累计用电量与电费，以及上月每日明细。
- 今年、去年累计用电量与电费，以及按月明细。

本集成只获取南网返回的数据，不自行计算峰谷电价或正式账单。

## 更新策略

- 普通数据按设置的更新间隔刷新，默认 4 小时。
- 上月数据通常只在每月 1～3 日随普通数据刷新，之后保留已有结果。
- 去年数据通常只在每年 1 月 1～7 日刷新，之后保留已有结果。
- 如需立即重新拉取，可在集成页面点击 **重新加载**。

## 常见问题

### HACS 中搜索不到

本仓库目前属于 HACS 自定义仓库，需要先按上面的步骤添加仓库地址，再搜索下载。

### 点击“配置”仍然报 500

请在 HACS 中确认已更新到最新版本，然后重启 Home Assistant。浏览器页面无需单独清理资源；必要时可强制刷新一次前端缓存。

### 左侧没有“用电日历”

确认已经完成以下三步：

1. Home Assistant 已重启。
2. 集成已成功添加且不是“需要重新认证”状态。
3. 至少添加了一个缴费号，并已完成第一次数据更新。

### 登录状态过期

南网当前的登录接口不支持可靠的自动重新登录。Home Assistant 提示需要重新认证时，请按界面提示重新登录。

### 手动安装

将以下目录完整复制到 Home Assistant 的 `/config/custom_components/`：

```text
custom_components/china_southern_power_grid_stat
```

最终路径应为：

```text
/config/custom_components/china_southern_power_grid_stat/manifest.json
```

然后重启 Home Assistant 并添加集成。文件位于 `/config`，升级 Home Assistant 容器或镜像不会删除它。

## 隐私与安全

- 登录令牌和缴费号保存在 Home Assistant 的配置存储中，请妥善保护 `/config` 备份。
- 不要在 Issue、日志截图或公开聊天中提交手机号、验证码、密码、令牌、完整缴费号和家庭地址。
- 本集成不会把这些信息上传到本项目维护者的服务器；数据请求直接由 Home Assistant 发往南方电网接口。

## 项目来源

本项目基于 [CubicPill/china_southern_power_grid_stat](https://github.com/CubicPill/china_southern_power_grid_stat) 的 GPL-3.0 代码继续维护，保留原项目许可，并新增 Home Assistant 新版兼容修复和内置用电日历。感谢原作者及所有贡献者。

## 开发与反馈

- 问题反馈：[GitHub Issues](https://github.com/lifujie25/ha-china-southern/issues)
- 更新记录：[CHANGELOG.md](CHANGELOG.md)
- 许可证：[GPL-3.0](LICENSE)
