class CsgElectricityCalendarPanel extends HTMLElement {
  connectedCallback() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    this.addEventListener("click", (event) => {
      const button = event.target.closest?.("[data-action]");
      if (!button || button.disabled) return;

      if (button.dataset.action === "previous" && this._monthOffset !== -1) {
        this._monthOffset = -1;
        this._renderSignature = "";
        this._render();
      }

      if (button.dataset.action === "next" && this._monthOffset !== 0) {
        this._monthOffset = 0;
        this._renderSignature = "";
        this._render();
      }
    });

    this.addEventListener("change", (event) => {
      if (event.target.matches?.(".account-select")) {
        this._selectedAccount = Number(event.target.value);
        this._renderSignature = "";
        this._render();
      }

      if (event.target.matches?.(".month-select")) {
        this._monthOffset = Number(event.target.value) === -1 ? -1 : 0;
        this._renderSignature = "";
        this._render();
      }
    });
  }

  set hass(hass) {
    this._hass = hass;
    this._accounts = this._discoverAccounts(hass);
    this._selectedAccount = Math.min(
      this._selectedAccount || 0,
      Math.max(this._accounts.length - 1, 0),
    );
    this._monthOffset = this._monthOffset === -1 ? -1 : 0;

    const account = this._accounts[this._selectedAccount || 0];
    const entities = account
      ? [account.current_entity, account.previous_entity]
      : [];
    const signature = JSON.stringify(
      [
        ...this._accounts.map((item) => [
          item.account_number,
          item.name,
          item.address,
        ]),
        ...entities.map((entityId) => {
        const state = hass.states[entityId];
        return state
          ? [entityId, state.state, state.last_updated, state.attributes]
          : [entityId, null];
        }),
      ],
    );

    if (signature !== this._renderSignature) {
      this._renderSignature = signature;
      this._render();
    }
  }

  _discoverAccounts(hass) {
    const accounts = new Map();

    for (const [entityId, stateObj] of Object.entries(hass?.states || {})) {
      const attributes = stateObj?.attributes || {};
      const hasCurrent = Array.isArray(attributes.this_month_by_day);
      const hasPrevious = Array.isArray(attributes.last_month_by_day);
      const isEnergySensor =
        attributes.device_class === "energy" ||
        attributes.unit_of_measurement === "kWh";
      if ((!hasCurrent && !hasPrevious) || !isEnergySensor) continue;

      const accountNumber = attributes.csg_account_number;
      if (!accountNumber) continue;

      const account = accounts.get(accountNumber) || {
        account_number: accountNumber,
        name: attributes.csg_user_name || "",
        address: attributes.csg_address || "",
      };
      if (hasCurrent) account.current_entity = entityId;
      if (hasPrevious) account.previous_entity = entityId;
      accounts.set(accountNumber, account);
    }

    return [...accounts.values()]
      .filter((account) => account.current_entity && account.previous_entity)
      .sort((a, b) => a.account_number.localeCompare(b.account_number));
  }

  _escape(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  _formatNumber(value, digits = 2) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(digits) : "—";
  }

  _monthData(monthOffset = this._monthOffset) {
    const account = this._accounts[this._selectedAccount];
    const isCurrent = monthOffset === 0;
    const entityId = isCurrent
      ? account.current_entity
      : account.previous_entity;
    const attributeKey = isCurrent
      ? "this_month_by_day"
      : "last_month_by_day";
    const stateObj = this._hass?.states?.[entityId];
    const rawDaily = stateObj?.attributes?.[attributeKey];
    const daily = Array.isArray(rawDaily)
      ? rawDaily
          .filter((item) => item && item.date && Number.isFinite(Number(item.kwh)))
          .map((item) => ({
            date: String(item.date),
            kwh: Number(item.kwh),
            charge: Number.isFinite(Number(item.charge))
              ? Number(item.charge)
              : null,
          }))
          .sort((a, b) => a.date.localeCompare(b.date))
      : [];

    let year;
    let month;
    const firstDate = daily[0]?.date?.match(/^(\d{4})-(\d{2})-\d{2}$/);
    if (firstDate) {
      year = Number(firstDate[1]);
      month = Number(firstDate[2]);
    } else {
      const fallback = new Date();
      fallback.setMonth(fallback.getMonth() + monthOffset);
      year = fallback.getFullYear();
      month = fallback.getMonth() + 1;
    }

    const dailySum = daily.reduce((sum, item) => sum + item.kwh, 0);
    const entityTotal = Number(stateObj?.state);
    const total = Number.isFinite(entityTotal) ? entityTotal : dailySum;
    const average = daily.length ? total / daily.length : null;

    return {
      account,
      entityId,
      stateObj,
      daily,
      year,
      month,
      total,
      average,
      isCurrent,
    };
  }

  _cellClass(kwh) {
    if (!Number.isFinite(kwh)) return "no-data";
    if (kwh <= 5) return "level-low";
    if (kwh <= 10) return "level-medium";
    if (kwh <= 15) return "level-high";
    return "level-very-high";
  }

  _calendarCells(data) {
    const { year, month, daily, isCurrent } = data;
    const usageByDate = new Map(daily.map((item) => [item.date, item]));
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstWeekday = new Date(year, month - 1, 1).getDay();
    const previousMonthDays = new Date(year, month - 1, 0).getDate();
    const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
    const today = new Date();
    const cells = [];

    for (let index = 0; index < cellCount; index += 1) {
      const day = index - firstWeekday + 1;
      if (day < 1) {
        cells.push(
          `<div class="day-cell outside"><span>${previousMonthDays + day}</span></div>`,
        );
        continue;
      }

      if (day > daysInMonth) {
        cells.push(
          `<div class="day-cell outside"><span>${day - daysInMonth}</span></div>`,
        );
        continue;
      }

      const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const item = usageByDate.get(dateKey);
      const isToday =
        isCurrent &&
        today.getFullYear() === year &&
        today.getMonth() + 1 === month &&
        today.getDate() === day;
      const valueMarkup = item
        ? `<span class="usage">${this._formatNumber(item.kwh)}<small>度</small></span>`
        : `<span class="usage missing">暂无数据</span>`;
      const title = item
        ? `${dateKey}：${this._formatNumber(item.kwh)} 度${
            item.charge !== null
              ? `，${this._formatNumber(item.charge)} 元`
              : ""
          }`
        : `${dateKey}：暂无数据`;

      cells.push(`
        <div class="day-cell ${this._cellClass(item?.kwh)} ${isToday ? "today" : ""}"
             title="${this._escape(title)}">
          <span class="day-number">${day}</span>
          ${valueMarkup}
        </div>
      `);
    }

    return cells.join("");
  }

  _render() {
    if (!this._hass) return;

    if (!this._accounts?.length) {
      this.innerHTML = `
        <style>
          :host { display: block; padding: 24px; }
          ha-card {
            max-width: 760px;
            margin: 0 auto;
            padding: 34px 24px;
            text-align: center;
          }
          ha-icon {
            color: var(--primary-color);
            --mdc-icon-size: 48px;
          }
          h1 { margin: 16px 0 8px; font-size: 24px; }
          p {
            margin: 0 auto 20px;
            max-width: 520px;
            color: var(--secondary-text-color);
            line-height: 1.65;
          }
          a {
            display: inline-block;
            padding: 10px 18px;
            color: var(--text-primary-color, #fff);
            border-radius: 12px;
            background: var(--primary-color);
            text-decoration: none;
            font-weight: 650;
          }
        </style>
        <ha-card>
          <ha-icon icon="mdi:transmission-tower"></ha-icon>
          <h1>还没有可显示的缴费号</h1>
          <p>请先打开“南方电网用电统计与日历”集成，点击“配置”，添加一个已绑定的缴费号。数据首次更新后会自动显示在这里。</p>
          <a href="/config/integrations/integration/china_southern_power_grid_stat">前往集成设置</a>
        </ha-card>
      `;
      return;
    }

    const currentMonthData = this._monthData(0);
    const previousMonthData = this._monthData(-1);
    const data =
      this._monthOffset === -1 ? previousMonthData : currentMonthData;
    const monthOptions = [currentMonthData, previousMonthData]
      .map(
        (monthData) => `
          <option value="${monthData.isCurrent ? 0 : -1}" ${
            monthData.isCurrent === data.isCurrent ? "selected" : ""
          }>
            ${monthData.year}年${monthData.month}月
          </option>
        `,
      )
      .join("");
    const accountOptions = this._accounts
      .map((account, index) => {
        const label =
          [account.name, account.account_number, account.address]
            .filter(Boolean)
            .join(" · ") || `缴费号 ${index + 1}`;
        return `<option value="${index}" ${
          index === this._selectedAccount ? "selected" : ""
        }>${this._escape(label)}</option>`;
      })
      .join("");
    const updatedAt = data.stateObj?.last_updated
      ? new Date(data.stateObj.last_updated).toLocaleString("zh-CN", {
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

    this.innerHTML = `
      <ha-card>
        <style>
          :host {
            --csg-blue: #2488f5;
            --csg-green: #e4f8e6;
            --csg-medium: #e6f0ff;
            --csg-high: #fff1d7;
            --csg-very-high: #ffe3e8;
            display: block;
            padding: 24px;
          }

          * {
            box-sizing: border-box;
          }

          ha-card {
            width: min(820px, 100%);
            margin: 0 auto;
            overflow: hidden;
            border-radius: var(--ha-card-border-radius, 18px);
          }

          .hero {
            position: relative;
            padding: 22px 22px 20px;
            color: #113c72;
            background:
              radial-gradient(circle at 85% 22%, rgba(255,255,255,.9) 0 8%, transparent 9%),
              radial-gradient(circle at 77% 65%, rgba(255,255,255,.55) 0 12%, transparent 13%),
              linear-gradient(145deg, #dff6ff 0%, #b9e1ff 52%, #f6fbff 100%);
          }

          .hero::after {
            content: "⚡";
            position: absolute;
            right: 24px;
            top: 13px;
            display: grid;
            place-items: center;
            width: 76px;
            height: 76px;
            font-size: 38px;
            border-radius: 24px;
            transform: rotate(5deg);
            background: linear-gradient(150deg, #43c7ff, #1878ed);
            box-shadow: 0 12px 28px rgba(21, 115, 218, .28);
          }

          .hero h1 {
            position: relative;
            z-index: 1;
            max-width: calc(100% - 92px);
            margin: 0;
            font-size: 25px;
            font-weight: 800;
            letter-spacing: .04em;
          }

          .hero p {
            position: relative;
            z-index: 1;
            max-width: calc(100% - 92px);
            margin: 8px 0 0;
            color: rgba(17, 60, 114, .68);
            font-size: 14px;
          }

          .content {
            padding: 18px;
            background: var(--ha-card-background, var(--card-background-color, #fff));
          }

          .account-row {
            display: grid;
            grid-template-columns: auto minmax(0, 1fr);
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
          }

          .account-icon {
            display: grid;
            place-items: center;
            width: 42px;
            height: 42px;
            color: var(--csg-blue);
            border-radius: 13px;
            background: color-mix(in srgb, var(--csg-blue) 12%, transparent);
          }

          .account-icon ha-icon {
            --mdc-icon-size: 24px;
          }

          .account-select {
            width: 100%;
            min-width: 0;
            padding: 11px 38px 11px 13px;
            color: var(--primary-text-color);
            font: inherit;
            font-size: 15px;
            font-weight: 650;
            border: 1px solid var(--divider-color);
            border-radius: 13px;
            outline: none;
            background: var(--card-background-color);
          }

          .month-row {
            display: flex;
            justify-content: center;
            margin: 2px 0 14px;
          }

          .month-select {
            min-width: 174px;
            padding: 9px 34px 9px 16px;
            color: var(--primary-text-color);
            border: 1px solid var(--divider-color);
            border-radius: 13px;
            outline: none;
            background: var(--card-background-color);
            text-align: center;
            font-size: 21px;
            font-weight: 800;
          }

          .summary {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 12px;
          }

          .summary-item {
            min-width: 0;
            padding: 14px;
            border: 1px solid color-mix(in srgb, var(--csg-blue) 12%, transparent);
            border-radius: 14px;
            background: color-mix(in srgb, var(--csg-blue) 7%, var(--card-background-color));
          }

          .summary-label {
            overflow: hidden;
            color: var(--secondary-text-color);
            font-size: 13px;
            white-space: nowrap;
            text-overflow: ellipsis;
          }

          .summary-value {
            margin-top: 5px;
            color: var(--primary-text-color);
            font-size: 25px;
            font-weight: 800;
          }

          .summary-value small {
            margin-left: 3px;
            color: var(--secondary-text-color);
            font-size: 12px;
            font-weight: 500;
          }

          .notice {
            display: flex;
            align-items: flex-start;
            gap: 7px;
            margin: 2px 1px 14px;
            color: #df8315;
            font-size: 12px;
            line-height: 1.45;
          }

          .notice ha-icon {
            flex: 0 0 auto;
            margin-top: 1px;
            --mdc-icon-size: 17px;
          }

          .weekdays,
          .calendar-grid {
            display: grid;
            grid-template-columns: repeat(7, minmax(0, 1fr));
            gap: 5px;
          }

          .weekdays {
            margin-bottom: 6px;
          }

          .weekday {
            padding: 4px 0;
            color: var(--secondary-text-color);
            text-align: center;
            font-size: 12px;
          }

          .day-cell {
            position: relative;
            display: flex;
            min-width: 0;
            aspect-ratio: .92;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 3px;
            padding: 4px 2px;
            color: var(--primary-text-color);
            border: 1px solid transparent;
            border-radius: 10px;
            text-align: center;
          }

          .day-number {
            font-size: 14px;
            font-weight: 700;
          }

          .usage {
            max-width: 100%;
            overflow: hidden;
            font-size: 11px;
            white-space: nowrap;
            text-overflow: ellipsis;
          }

          .usage small {
            font-size: 9px;
          }

          .usage.missing {
            color: var(--secondary-text-color);
            font-size: 9px;
          }

          .outside {
            color: color-mix(in srgb, var(--secondary-text-color) 42%, transparent);
            background: color-mix(in srgb, var(--secondary-background-color) 50%, transparent);
          }

          .level-low { background: var(--csg-green); color: #245c2f; }
          .level-medium { background: var(--csg-medium); color: #275481; }
          .level-high { background: var(--csg-high); color: #7b5119; }
          .level-very-high { background: var(--csg-very-high); color: #873847; }
          .no-data { background: var(--secondary-background-color); }

          .today {
            border-color: var(--csg-blue);
            box-shadow: inset 0 0 0 1px var(--csg-blue);
          }

          .legend {
            display: flex;
            flex-wrap: wrap;
            gap: 8px 13px;
            margin-top: 15px;
            color: var(--secondary-text-color);
            font-size: 11px;
          }

          .legend-item {
            display: inline-flex;
            align-items: center;
            gap: 5px;
          }

          .legend-swatch {
            width: 13px;
            height: 13px;
            border-radius: 4px;
          }

          .footer {
            margin-top: 12px;
            color: var(--secondary-text-color);
            text-align: right;
            font-size: 10px;
          }

          @media (max-width: 420px) {
            :host {
              padding: 0;
            }

            ha-card {
              border-radius: 0;
            }
            .hero {
              padding: 19px 17px 18px;
            }

            .hero::after {
              right: 17px;
              width: 66px;
              height: 66px;
              border-radius: 21px;
              font-size: 32px;
            }

            .hero h1 {
              font-size: 22px;
            }

            .content {
              padding: 15px 12px 16px;
            }

            .calendar-grid,
            .weekdays {
              gap: 3px;
            }

            .day-cell {
              border-radius: 8px;
            }

            .day-number {
              font-size: 13px;
            }

            .usage {
              font-size: 9.5px;
            }

            .usage small {
              font-size: 8px;
            }
          }
        </style>

        <div class="hero">
          <h1>用电日历</h1>
          <p>回溯每日用电，趋势一目了然</p>
        </div>

        <div class="content">
          <div class="account-row">
            <div class="account-icon">
              <ha-icon icon="mdi:home-lightning-bolt-outline"></ha-icon>
            </div>
            <select class="account-select" aria-label="选择缴费号">
              ${accountOptions}
            </select>
          </div>

          <div class="month-row">
            <select class="month-select" aria-label="选择月份">
              ${monthOptions}
            </select>
          </div>

          <div class="summary">
            <div class="summary-item">
              <div class="summary-label">${data.month}月累计电量</div>
              <div class="summary-value">${this._formatNumber(data.total)}<small>度</small></div>
            </div>
            <div class="summary-item">
              <div class="summary-label">日均电量</div>
              <div class="summary-value">${this._formatNumber(data.average)}<small>度</small></div>
            </div>
          </div>

          <div class="notice">
            <ha-icon icon="mdi:information-outline"></ha-icon>
            <span>每日数据通常延迟约 2 天，仅供用电趋势参考。</span>
          </div>

          <div class="weekdays">
            ${["日", "一", "二", "三", "四", "五", "六"]
              .map((day) => `<div class="weekday">${day}</div>`)
              .join("")}
          </div>

          <div class="calendar-grid">
            ${this._calendarCells(data)}
          </div>

          <div class="legend">
            <span class="legend-item"><i class="legend-swatch level-low"></i>0–5度</span>
            <span class="legend-item"><i class="legend-swatch level-medium"></i>5–10度</span>
            <span class="legend-item"><i class="legend-swatch level-high"></i>10–15度</span>
            <span class="legend-item"><i class="legend-swatch level-very-high"></i>15度以上</span>
          </div>

          <div class="footer">数据更新：${this._escape(updatedAt)}</div>
        </div>
      </ha-card>
    `;

  }
}

if (!customElements.get("csg-electricity-calendar-panel")) {
  customElements.define(
    "csg-electricity-calendar-panel",
    CsgElectricityCalendarPanel,
  );
}
