import { Component, OnInit, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  SyncApiService,
  DashboardAnalyticsResponse,
  AccessUtilizationResponse,
  ReportUsageItem,
  PageUsageItem,
  UserUsageItem,
  TimelineItem,
  AccessUserItem,
} from './sync.service';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-usage',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    :host {
      display: block;
      color: #0f172a;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    }

    .analytics-container {
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding-bottom: 24px;
    }

    /* ── Back Navigation Header for User Detail Page ── */
    .user-page-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .btn-back {
      background: #ffffff;
      color: #1d4ed8;
      border: 1.5px solid #bfdbfe;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13.5px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.15s;
    }

    .btn-back:hover {
      background: #eff6ff;
      border-color: #2563eb;
    }

    /* ── User Profile Banner (on User Detail Page) ── */
    .user-profile-banner {
      background: #ffffff;
      border: 1.5px solid #dbeafe;
      border-radius: 14px;
      padding: 18px 22px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      box-shadow: 0 2px 8px -2px rgba(37, 99, 235, 0.05);
      flex-wrap: wrap;
    }

    .user-profile-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .user-profile-avatar {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      font-size: 20px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .user-profile-name {
      font-size: 17px;
      font-weight: 600;
      color: #0f172a;
    }

    .user-profile-email {
      font-size: 13.5px;
      color: #1e40af;
      font-weight: 500;
      margin-top: 2px;
    }

    /* ── Top Filter Bar (6 Searchable Dropdowns) ── */
    .filter-bar-card {
      background: #ffffff;
      border: 1.5px solid #dbeafe;
      border-radius: 14px;
      padding: 14px 18px;
      box-shadow: 0 2px 8px -2px rgba(37, 99, 235, 0.05);
      display: flex;
      flex-direction: column;
      gap: 10px;
      box-sizing: border-box;
    }

    .filter-bar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .filter-title {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .filter-badge {
      background: #eff6ff;
      color: #1d4ed8;
      font-size: 12px;
      padding: 2px 9px;
      border-radius: 99px;
      font-weight: 600;
      border: 1px solid #bfdbfe;
    }

    .btn-reset {
      background: #ffffff;
      color: #dc2626;
      border: 1.5px solid #fecaca;
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s;
    }

    .btn-reset:hover {
      background: #fef2f2;
      border-color: #f87171;
    }

    .filter-grid {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 8px;
      width: 100%;
      box-sizing: border-box;
      align-items: end;
    }

    @media (max-width: 960px) {
      .filter-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    @media (max-width: 560px) {
      .filter-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    .filter-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
      position: relative;
      min-width: 0;
    }

    .filter-label {
      font-size: 13.5px;
      font-weight: 700;
      color: #1e3a8a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 2px;
      letter-spacing: -0.1px;
    }

    /* Custom Searchable Select Trigger */
    .dropdown-trigger {
      height: 38px;
      background: #ffffff;
      border: 1.5px solid #bfdbfe;
      border-radius: 8px;
      padding: 0 28px 0 10px;
      font-size: 13px;
      font-weight: 500;
      color: #0f172a;
      cursor: pointer;
      display: flex;
      align-items: center;
      position: relative;
      transition: all 0.15s;
      width: 100%;
      box-sizing: border-box;
    }

    .dropdown-trigger:hover {
      border-color: #2563eb;
      background: #eff6ff;
    }

    .dropdown-trigger.active-filter {
      border-color: #1d4ed8;
      background: #eff6ff;
      color: #1e40af;
      font-weight: 600;
    }

    .trigger-text {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
      text-align: left;
    }

    .trigger-clear-btn {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1e40af;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      padding: 0;
      margin-right: 4px;
      border-radius: 50%;
      transition: all 0.15s ease;
      z-index: 2;
      flex-shrink: 0;
    }

    .trigger-clear-btn:hover {
      color: #ffffff;
      background: #dc2626;
      border-color: #dc2626;
    }

    .trigger-caret {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
      color: #2563eb;
      display: flex;
      align-items: center;
    }

    /* Floating Dropdown Menu */
    .dropdown-menu-pop {
      position: absolute;
      top: calc(100% + 5px);
      left: 0;
      min-width: 220px;
      width: max-content;
      max-width: min(340px, 90vw);
      background: #ffffff;
      border: 1.5px solid #93c5fd;
      border-radius: 10px;
      box-shadow: 0 12px 28px -6px rgba(37, 99, 235, 0.15);
      z-index: 1000;
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: 280px;
      box-sizing: border-box;
    }

    .dropdown-menu-pop.pop-right {
      left: auto;
      right: 0;
    }

    .menu-search-input {
      width: 100%;
      height: 34px;
      border: 1.5px solid #bfdbfe;
      border-radius: 6px;
      padding: 0 10px;
      font-size: 12.5px;
      outline: none;
      box-sizing: border-box;
      color: #0f172a;
    }

    .menu-search-input:focus {
      border-color: #2563eb;
    }

    .menu-options-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      overflow-y: auto;
      max-height: 210px;
    }

    .menu-option-item {
      padding: 8px 10px;
      font-size: 12.5px;
      line-height: 1.4;
      min-height: 34px;
      color: #0f172a;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.12s;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      box-sizing: border-box;
      display: flex;
      align-items: center;
    }

    .menu-option-item:hover {
      background: #eff6ff;
      color: #1d4ed8;
      font-weight: 600;
    }

    .menu-option-item.selected {
      background: #dbeafe;
      color: #1e40af;
      font-weight: 700;
    }

    /* ── Overview KPI Cards (Blue Shades) ── */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 12px;
      width: 100%;
      box-sizing: border-box;
    }

    .kpi-grid.four-cols {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    @media (max-width: 1200px) {
      .kpi-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .kpi-grid.four-cols {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 768px) {
      .kpi-grid, .kpi-grid.four-cols {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 480px) {
      .kpi-grid, .kpi-grid.four-cols {
        grid-template-columns: 1fr;
      }
    }

    .kpi-card {
      background: #ffffff;
      border: 1.5px solid #dbeafe;
      border-radius: 12px;
      padding: 12px 18px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      box-shadow: 0 2px 6px -1px rgba(37, 99, 235, 0.04);
      transition: all 0.2s ease;
      box-sizing: border-box;
    }

    .kpi-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px -4px rgba(37, 99, 235, 0.12);
      border-color: #93c5fd;
    }

    .kpi-card.blue-1 { border-top: 4px solid #1e3a8a; }
    .kpi-card.blue-2 { border-top: 4px solid #1d4ed8; }
    .kpi-card.blue-3 { border-top: 4px solid #2563eb; }
    .kpi-card.blue-4 { border-top: 4px solid #3b82f6; }
    .kpi-card.blue-5 { border-top: 4px solid #0284c7; }

    .kpi-label {
      font-size: 12.5px;
      font-weight: 600;
      color: #1e40af;
      margin-bottom: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .kpi-value {
      font-size: 28px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.1;
      letter-spacing: -0.6px;
    }

    .kpi-sub {
      font-size: 12px;
      color: #1e40af;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 4px;
    }

    /* ── Overview Visuals Section (Yellow Graph + Blue Pie) ── */
    .overview-charts-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      width: 100%;
      box-sizing: border-box;
    }

    @media (max-width: 1024px) {
      .overview-charts-grid {
        grid-template-columns: 1fr;
      }
    }

    .card-outlined {
      background: #ffffff;
      border: 1.5px solid #dbeafe;
      border-radius: 14px;
      padding: 16px 18px;
      box-shadow: 0 2px 6px -1px rgba(37, 99, 235, 0.04);
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      min-width: 0;
    }

    .card-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      flex-wrap: wrap;
      gap: 8px;
    }

    .card-title {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
    }

    /* ── Yellow Monthly Bar Graph ── */
    .monthly-chart-wrap {
      display: flex;
      flex-direction: column;
      height: 230px;
      justify-content: flex-end;
      padding-top: 8px;
      width: 100%;
      box-sizing: border-box;
    }

    .monthly-bars-container {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      height: 180px;
      width: 100%;
      padding-bottom: 6px;
      border-bottom: 1.5px solid #dbeafe;
      box-sizing: border-box;
    }

    .monthly-bar-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      flex: 1 1 0;
      min-width: 0;
      height: 100%;
      justify-content: flex-end;
    }

    .monthly-bar-val {
      font-size: 11px;
      font-weight: 700;
      color: #0f172a;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    /* Clean Solid Yellow Bars */
    .monthly-bar-pill {
      width: 100%;
      max-width: 36px;
      background: #f59e0b;
      border-radius: 4px 4px 0 0;
      min-height: 8px;
      transition: all 0.2s ease;
      cursor: pointer;
    }

    .monthly-bar-pill:hover {
      background: #d97706;
      transform: scaleY(1.03);
    }

    .monthly-bar-lbl {
      font-size: 11px;
      font-weight: 600;
      color: #334155;
      text-align: center;
      margin-top: 4px;
      white-space: nowrap;
      letter-spacing: -0.2px;
    }

    /* ── Big Blue Pie / Donut Chart ── */
    .donut-overview-container {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 26px;
      height: 230px;
      width: 100%;
      box-sizing: border-box;
    }

    @media (max-width: 640px) {
      .donut-overview-container {
        flex-direction: column;
        height: auto;
      }
    }

    .donut-circle-wrap {
      width: 190px;
      height: 190px;
      border-radius: 50%;
      position: relative;
      flex-shrink: 0;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.08);
    }

    .donut-hole {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 120px;
      height: 120px;
      background: #ffffff;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.04);
    }

    .donut-hole-val {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1;
      letter-spacing: -0.5px;
    }

    .donut-hole-lbl {
      font-size: 11px;
      font-weight: 600;
      color: #1e40af;
      margin-top: 3px;
    }

    .donut-legend {
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1;
      min-width: 0;
    }

    .legend-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: 13px;
    }

    .legend-left {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      flex: 1;
    }

    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 3px;
      flex-shrink: 0;
    }

    .legend-name {
      color: #0f172a;
      font-weight: 400;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .legend-views {
      font-weight: 700;
      color: #0f172a;
      font-variant-numeric: tabular-nums;
      flex-shrink: 0;
    }

    /* ── Unified Tabbed Breakdown Card (Pages / People / Access) ── */
    .unified-breakdown-card {
      background: #ffffff;
      border: 1.5px solid #dbeafe;
      border-radius: 12px;
      padding: 14px 18px;
      box-shadow: 0 1px 3px rgba(37, 99, 235, 0.03);
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      width: 100%;
    }

    .breakdown-top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }

    .segmented-tabs {
      display: inline-flex;
      background: #eff6ff;
      padding: 3px;
      border-radius: 8px;
      border: 1px solid #bfdbfe;
      gap: 2px;
    }

    .segmented-tab {
      background: transparent;
      border: none;
      padding: 5px 14px;
      font-size: 12.5px;
      font-weight: 600;
      color: #1e3a8a;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s ease;
      font-family: inherit;
    }

    .segmented-tab:hover {
      color: #1d4ed8;
    }

    .segmented-tab.active {
      background: #ffffff;
      color: #1d4ed8;
      font-weight: 700;
      box-shadow: 0 1px 3px rgba(37, 99, 235, 0.1);
    }

    .breakdown-search-input {
      background: #f8fafc;
      border: 1.5px solid #dbeafe;
      border-radius: 6px;
      height: 32px;
      padding: 0 10px;
      font-size: 12px;
      color: #0f172a;
      outline: none;
      width: 150px;
      transition: border-color 0.15s, background 0.15s;
      box-sizing: border-box;
      font-family: inherit;
    }

    .breakdown-search-input:focus {
      border-color: #2563eb;
      background: #ffffff;
    }

    .access-sub-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #eff6ff;
    }

    .access-pill-tabs {
      display: inline-flex;
      gap: 3px;
      background: #eff6ff;
      padding: 2.5px;
      border-radius: 6px;
      border: 1px solid #bfdbfe;
    }

    .access-pill-btn {
      background: transparent;
      border: none;
      padding: 3.5px 10px;
      font-size: 11.5px;
      font-weight: 600;
      color: #1e3a8a;
      border-radius: 5px;
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
      font-family: inherit;
    }

    .access-pill-btn.active {
      background: #ffffff;
      color: #1d4ed8;
      box-shadow: 0 1px 2px rgba(37, 99, 235, 0.08);
      font-weight: 700;
    }

    .breakdown-subtitle {
      font-size: 11.5px;
      color: #1e3a8a;
      font-weight: 500;
      margin-top: 6px;
      margin-bottom: 2px;
    }

    .breakdown-list-container {
      display: flex;
      flex-direction: column;
      max-height: 480px;
      overflow-y: auto;
      padding-right: 4px;
    }

    .breakdown-row-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 9px 4px;
      border-bottom: 1px solid #eff6ff;
      transition: background 0.12s;
    }

    .breakdown-row-item:last-child {
      border-bottom: none;
    }

    .breakdown-row-item.interactive {
      cursor: pointer;
    }

    .breakdown-row-item.interactive:hover {
      background: #eff6ff;
      border-radius: 6px;
      padding-left: 8px;
      padding-right: 8px;
    }

    .row-rank-tag {
      font-size: 12px;
      font-weight: 700;
      color: #1d4ed8;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 4px;
      padding: 1px 6px;
      flex-shrink: 0;
    }

    .row-primary-title {
      font-size: 13px;
      font-weight: 600;
      color: #0f172a;
      line-height: 1.25;
    }

    .row-secondary-info {
      font-size: 11.5px;
      color: #1e3a8a;
      margin-top: 2px;
      font-weight: 500;
    }

    .row-metric-box {
      text-align: right;
      flex-shrink: 0;
    }

    .row-metric-val {
      font-size: 13.5px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.2;
    }

    .row-metric-sub {
      font-size: 11px;
      color: #1e3a8a;
      margin-top: 1px;
      font-weight: 500;
    }

    .breakdown-bottom-pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 8px;
      margin-top: 2px;
      border-top: 1px solid #eff6ff;
      flex-wrap: wrap;
      gap: 8px;
    }

    .footer-range-txt {
      font-size: 11.5px;
      color: #1e3a8a;
      font-weight: 500;
    }

    .footer-nav-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-card-nav {
      background: #ffffff;
      border: 1.5px solid #dbeafe;
      border-radius: 6px;
      padding: 3px 10px;
      font-size: 11.5px;
      font-weight: 600;
      color: #1e3a8a;
      cursor: pointer;
      transition: all 0.15s;
    }

    .btn-card-nav:hover:not(:disabled) {
      background: #eff6ff;
      border-color: #2563eb;
      color: #1d4ed8;
    }

    .btn-card-nav:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }

    .footer-page-indicator {
      font-size: 11.5px;
      color: #1e3a8a;
      font-weight: 600;
    }

    @media (max-width: 768px) {
      .breakdown-top-bar {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
      }

      .segmented-tabs {
        width: 100%;
        display: flex;
        box-sizing: border-box;
      }

      .segmented-tab {
        flex: 1;
        text-align: center;
        padding: 6px 8px;
        font-size: 12px;
      }

      .breakdown-search-input {
        width: 100% !important;
      }

      .access-sub-bar {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
      }

      .access-pill-tabs {
        width: 100%;
        display: flex;
        box-sizing: border-box;
      }

      .access-pill-btn {
        flex: 1;
        text-align: center;
        padding: 4px 6px;
        font-size: 11px;
      }
    }

    @media (max-width: 600px) {
      .unified-breakdown-card {
        padding: 12px 14px;
      }

      .breakdown-row-item {
        padding: 8px 2px;
        gap: 8px;
      }

      .row-primary-title {
        font-size: 12.5px;
        max-width: 180px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .row-secondary-info {
        font-size: 11px;
        max-width: 180px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .row-metric-val {
        font-size: 12.5px;
      }

      .breakdown-bottom-pagination {
        flex-direction: column;
        align-items: center;
        gap: 8px;
      }
    }

    /* ── Page-wise Usage List (Clean Rows Without Underline & Without Grey Badge) ── */
    .page-diagram-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-right: 2px;
    }

    .page-clean-row {
      background: #ffffff;
      border: 1.5px solid #dbeafe;
      border-radius: 9px;
      padding: 9px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      transition: all 0.15s ease;
    }

    .page-clean-row:hover {
      background: #eff6ff;
      border-color: #2563eb;
      box-shadow: 0 2px 6px rgba(37, 99, 235, 0.08);
    }

    .page-title-group {
      min-width: 0;
      flex: 1;
      display: flex;
      align-items: center;
      gap: 9px;
    }

    .page-rank-pill {
      font-size: 11.5px;
      font-weight: 600;
      background: #eff6ff;
      color: #1d4ed8;
      padding: 2px 8px;
      border-radius: 5px;
      border: 1px solid #bfdbfe;
      flex-shrink: 0;
    }

    .page-name {
      font-size: 13.5px;
      font-weight: 600;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .page-report-tag {
      font-size: 11.5px;
      color: #64748b;
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .page-report-tag strong {
      color: #1d4ed8;
      font-weight: 600;
    }

    .page-stats-right {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }

    .page-views-num {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      font-variant-numeric: tabular-nums;
    }

    .page-viewers-lbl {
      font-size: 12.5px;
      color: #1e40af;
      font-weight: 500;
    }

    /* ── User-wise Analysis List Item (Click navigates to user page) ── */
    .user-list {
      display: flex;
      flex-direction: column;
      gap: 7px;
      padding-right: 2px;
    }

    .user-card-item {
      background: #ffffff;
      border: 1.5px solid #dbeafe;
      border-radius: 9px;
      padding: 9px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      transition: all 0.15s ease;
      cursor: pointer;
    }

    .user-card-item:hover {
      border-color: #2563eb;
      background: #eff6ff;
      box-shadow: 0 3px 10px rgba(37, 99, 235, 0.1);
      transform: translateX(2px);
    }

    .user-meta-group {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
      flex: 1;
    }

    .user-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      font-size: 13.5px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .user-text-info {
      min-width: 0;
      flex: 1;
    }

    .user-fullname {
      font-size: 14px;
      font-weight: 500;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user-email-txt {
      font-size: 12px;
      color: #1e40af;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user-activity-right {
      text-align: right;
      flex-shrink: 0;
    }

    .user-views-txt {
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
    }

    .user-date-txt {
      font-size: 11.5px;
      color: #1e40af;
    }


    /* ── Pagination Controls Bar ── */
    .pagination-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 4px 2px 4px;
      margin-top: 4px;
      border-top: 1px solid #e0e7ff;
      flex-wrap: wrap;
      gap: 8px;
    }

    .pagination-info {
      font-size: 12.5px;
      font-weight: 600;
      color: #1e40af;
    }

    .pagination-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-page {
      background: #ffffff;
      color: #1d4ed8;
      border: 1.5px solid #bfdbfe;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      padding: 4px 10px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .btn-page:hover:not(:disabled) {
      background: #eff6ff;
      border-color: #2563eb;
    }

    .btn-page:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .page-current-pill {
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
      padding: 0 4px;
    }

    /* ── Access Level & Unused Access Audit ── */
    .access-section-card {
      background: #ffffff;
      border: 1.5px solid #dbeafe;
      border-radius: 14px;
      padding: 18px 22px;
      box-shadow: 0 2px 6px -1px rgba(37, 99, 235, 0.04);
      display: flex;
      flex-direction: column;
      gap: 14px;
      box-sizing: border-box;
    }

    .access-header-group {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }

    .access-tabs {
      display: flex;
      gap: 3px;
      background: #eff6ff;
      padding: 3px;
      border-radius: 7px;
      border: 1px solid #bfdbfe;
    }

    .access-tab-btn {
      background: transparent;
      border: none;
      padding: 4px 8px;
      font-size: 11px;
      font-weight: 600;
      color: #1e3a8a;
      border-radius: 5px;
      cursor: pointer;
      transition: all 0.15s;
      white-space: nowrap;
    }

    .access-tab-btn.active {
      background: #ffffff;
      color: #1d4ed8;
      box-shadow: 0 1px 3px rgba(37, 99, 235, 0.08);
      font-weight: 700;
    }

    .access-table-wrap {
      border: 1.5px solid #dbeafe;
      border-radius: 9px;
      overflow-x: auto;
      width: 100%;
      box-sizing: border-box;
    }

    .clean-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      text-align: left;
    }

    .clean-table th {
      background: #eff6ff;
      color: #1e3a8a;
      font-weight: 700;
      padding: 8px 10px;
      font-size: 11.5px;
      border-bottom: 1.5px solid #bfdbfe;
      position: sticky;
      top: 0;
      z-index: 2;
      white-space: nowrap;
    }

    .clean-table td {
      padding: 8px 10px;
      border-bottom: 1px solid #eff6ff;
      color: #0f172a;
      vertical-align: middle;
    }

    .clean-table tbody tr:hover td {
      background: #eff6ff;
    }

    .role-badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 99px;
      font-size: 11px;
      font-weight: 700;
      white-space: nowrap;
    }

    .role-admin { background: #fee2e2; color: #991b1b; }
    .role-member { background: #dbeafe; color: #1e40af; }
    .role-contributor { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
    .role-viewer { background: #f0f7ff; color: #1e3a8a; border: 1px solid #dbeafe; }

    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 3px 10px;
      border-radius: 99px;
      font-size: 12px;
      font-weight: 700;
    }

    .status-active { background: #dcfce7; color: #166534; }
    .status-unused { background: #fee2e2; color: #b91c1c; }

    .search-mini-input {
      height: 34px;
      padding: 0 12px;
      border: 1.5px solid #bfdbfe;
      border-radius: 7px;
      font-size: 13px;
      outline: none;
      width: 180px;
      box-sizing: border-box;
      color: #0f172a;
    }

    .search-mini-input:focus {
      border-color: #2563eb;
    }

    .spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid #dbeafe;
      border-top-color: #2563eb;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      vertical-align: middle;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
  template: `
    <div class="analytics-container">

      <!-- ── Optional Header for Dedicated User View ── -->
      <div class="user-page-nav" *ngIf="selectedUserEmail()">
        <button class="btn-back" (click)="clearSelectedUser()">
          Back to Main Dashboard
        </button>
      </div>

      <!-- ── User Profile Banner (when viewing user detail page) ── -->
      <div class="user-profile-banner" *ngIf="selectedUserEmail()">
        <div class="user-profile-left">
          <div class="user-profile-avatar"
               [style.background]="getUserAvatarStyle(currentUserObject()?.name || selectedUserEmail()).bg"
               [style.color]="getUserAvatarStyle(currentUserObject()?.name || selectedUserEmail()).color">
            {{ getUserInitial(currentUserObject()?.name || selectedUserEmail()) }}
          </div>
          <div>
            <div class="user-profile-name">
              {{ currentUserObject()?.name || selectedUserEmail() }}
            </div>
            <div class="user-profile-email">
              {{ selectedUserEmail() }}
            </div>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:12px;">
          <span class="status-badge status-active">
            Corporate Viewer
          </span>
        </div>
      </div>

      <!-- ── 1. Top Filter Bar (6 Searchable Dropdowns with Individual Clear Buttons) ── -->
      <div class="filter-bar-card">
        <div class="filter-bar-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="filter-title">Filters</span>
            <span class="filter-badge" *ngIf="activeFilterCount() > 0">{{ activeFilterCount() }} Active</span>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <button class="btn-back" style="font-size:12px; padding:6px 14px; background:#eff6ff; color:#1d4ed8; border-color:#bfdbfe; font-weight:600;" (click)="exportAccessMatrixExcel()" title="Download Excel sheet with report, page, and user access data filtered by active selections">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              Export Excel Sheet
            </button>
            <span *ngIf="loading()" style="font-size:12.5px; color:#1e40af; font-weight:600;">
              <span class="spinner"></span> Updating…
            </span>
            <button class="btn-reset" (click)="clearAllFilters()" [style.opacity]="hasAnyActiveFilter() ? '1' : '0.65'" [title]="hasAnyActiveFilter() ? 'Clear all active filters and search queries' : 'Reset all dashboard filters'">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              Clear All Filters
            </button>
          </div>
        </div>

        <div class="filter-grid">
          <!-- 1. Workspace Dropdown (Multi-select) -->
          <div class="filter-item">
            <label class="filter-label">Workspace</label>
            <div class="dropdown-trigger" [class.active-filter]="selectedWorkspaces().length > 0" (click)="toggleDropdown('ws', $event)">
              <span class="trigger-text">{{ getWorkspaceLabel() }}</span>
              <button *ngIf="selectedWorkspaces().length > 0" type="button" class="trigger-clear-btn" (click)="toggleWorkspace('', $event)" title="Clear Workspace filter">
                <svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" stroke-width="2.5" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
              <span class="trigger-caret">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </span>
            </div>
            <div class="dropdown-menu-pop" *ngIf="openDropdown() === 'ws'" (click)="$event.stopPropagation()">
              <input class="menu-search-input" [ngModel]="searchWs()" (ngModelChange)="searchWs.set($event)" placeholder="Search workspace…" (click)="$event.stopPropagation()" />
              <div class="menu-options-list">
                <div class="menu-option-item" [class.selected]="selectedWorkspaces().length === 0" (click)="toggleWorkspace('')">
                  <input type="checkbox" [checked]="selectedWorkspaces().length === 0" (click)="$event.stopPropagation()" (change)="toggleWorkspace('')" style="margin-right: 8px;" />
                  <span>All Workspaces</span>
                </div>
                <div class="menu-option-item" *ngFor="let ws of filteredWorkspaces()" [class.selected]="isWorkspaceSelected(ws.groupId)" (click)="toggleWorkspace(ws.groupId, $event)">
                  <input type="checkbox" [checked]="isWorkspaceSelected(ws.groupId)" (click)="$event.stopPropagation()" (change)="toggleWorkspace(ws.groupId)" style="margin-right: 8px;" />
                  <span>{{ ws.groupName }}</span>
                </div>
                <div *ngIf="!filteredWorkspaces().length" style="padding:8px 12px; font-size:12px; color:#1e40af;">No workspaces found</div>
              </div>
            </div>
          </div>

          <!-- 2. Report / Dashboard Dropdown (Multi-select) -->
          <div class="filter-item">
            <label class="filter-label">Report / Dashboard</label>
            <div class="dropdown-trigger" [class.active-filter]="selectedReports().length > 0" (click)="toggleDropdown('rep', $event)">
              <span class="trigger-text">{{ getReportLabel() }}</span>
              <button *ngIf="selectedReports().length > 0" type="button" class="trigger-clear-btn" (click)="toggleReport('', $event)" title="Clear Report/Dashboard filter">
                <svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" stroke-width="2.5" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
              <span class="trigger-caret">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </span>
            </div>
            <div class="dropdown-menu-pop" *ngIf="openDropdown() === 'rep'" (click)="$event.stopPropagation()">
              <input class="menu-search-input" [ngModel]="searchRep()" (ngModelChange)="searchRep.set($event)" placeholder="Search report or dashboard…" (click)="$event.stopPropagation()" />
              <div class="menu-options-list">
                <div class="menu-option-item" [class.selected]="selectedReports().length === 0" (click)="toggleReport('')">
                  <input type="checkbox" [checked]="selectedReports().length === 0" (click)="$event.stopPropagation()" (change)="toggleReport('')" style="margin-right: 8px;" />
                  <span>All Reports &amp; Dashboards</span>
                </div>
                <div class="menu-option-item" *ngFor="let r of filteredReports()" [class.selected]="isReportSelected(r.reportName)" (click)="toggleReport(r.reportName, $event)">
                  <input type="checkbox" [checked]="isReportSelected(r.reportName)" (click)="$event.stopPropagation()" (change)="toggleReport(r.reportName)" style="margin-right: 8px;" />
                  <span>{{ r.reportName }}</span>
                </div>
                <div *ngIf="!filteredReports().length" style="padding:8px 12px; font-size:12px; color:#1e40af;">No reports found</div>
              </div>
            </div>
          </div>

          <!-- 3. User Dropdown (Multi-select) -->
          <div class="filter-item">
            <label class="filter-label">User</label>
            <div class="dropdown-trigger" [class.active-filter]="selectedUsers().length > 0" (click)="toggleDropdown('user', $event)">
              <span class="trigger-text">{{ getUserLabel() }}</span>
              <button *ngIf="selectedUsers().length > 0" type="button" class="trigger-clear-btn" (click)="toggleUser('', $event)" title="Clear User filter">
                <svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" stroke-width="2.5" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
              <span class="trigger-caret">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </span>
            </div>
            <div class="dropdown-menu-pop pop-right" *ngIf="openDropdown() === 'user'" (click)="$event.stopPropagation()">
              <input class="menu-search-input" [ngModel]="searchUser()" (ngModelChange)="searchUser.set($event)" placeholder="Search user…" (click)="$event.stopPropagation()" />
              <div class="menu-options-list">
                <div class="menu-option-item" [class.selected]="selectedUsers().length === 0" (click)="toggleUser('')">
                  <input type="checkbox" [checked]="selectedUsers().length === 0" (click)="$event.stopPropagation()" (change)="toggleUser('')" style="margin-right: 8px;" />
                  <span>All Users</span>
                </div>
                <div class="menu-option-item" *ngFor="let u of filteredUsers()" [class.selected]="isUserSelected(u.email)" (click)="toggleUser(u.email, $event)">
                  <input type="checkbox" [checked]="isUserSelected(u.email)" (click)="$event.stopPropagation()" (change)="toggleUser(u.email)" style="margin-right: 8px;" />
                  <span>{{ u.name || u.email }}</span>
                </div>
                <div *ngIf="!filteredUsers().length" style="padding:8px 12px; font-size:12px; color:#1e40af;">No users found</div>
              </div>
            </div>
          </div>

          <!-- 4. Year Dropdown (Multi-select) -->
          <div class="filter-item">
            <label class="filter-label">Year</label>
            <div class="dropdown-trigger" [class.active-filter]="selectedYears().length > 0" (click)="toggleDropdown('year', $event)">
              <span class="trigger-text">{{ getYearLabel() }}</span>
              <button *ngIf="selectedYears().length > 0" type="button" class="trigger-clear-btn" (click)="toggleYear('', $event)" title="Clear Year filter">
                <svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" stroke-width="2.5" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
              <span class="trigger-caret">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </span>
            </div>
            <div class="dropdown-menu-pop pop-right" *ngIf="openDropdown() === 'year'" (click)="$event.stopPropagation()">
              <input class="menu-search-input" [ngModel]="searchYear()" (ngModelChange)="searchYear.set($event)" placeholder="Search year…" (click)="$event.stopPropagation()" />
              <div class="menu-options-list">
                <div class="menu-option-item" [class.selected]="selectedYears().length === 0" (click)="toggleYear('')">
                  <input type="checkbox" [checked]="selectedYears().length === 0" (click)="$event.stopPropagation()" (change)="toggleYear('')" style="margin-right: 8px;" />
                  <span>All Years</span>
                </div>
                <div class="menu-option-item" *ngFor="let y of filteredYears()" [class.selected]="isYearSelected('' + y)" (click)="toggleYear('' + y, $event)">
                  <input type="checkbox" [checked]="isYearSelected('' + y)" (click)="$event.stopPropagation()" (change)="toggleYear('' + y)" style="margin-right: 8px;" />
                  <span>{{ y }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 5. Month Dropdown (Multi-select) -->
          <div class="filter-item">
            <label class="filter-label">Month</label>
            <div class="dropdown-trigger" [class.active-filter]="selectedMonths().length > 0" (click)="toggleDropdown('month', $event)">
              <span class="trigger-text">{{ getMonthLabel() }}</span>
              <button *ngIf="selectedMonths().length > 0" type="button" class="trigger-clear-btn" (click)="toggleMonth('', $event)" title="Clear Month filter">
                <svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" stroke-width="2.5" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
              <span class="trigger-caret">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </span>
            </div>
            <div class="dropdown-menu-pop pop-right" *ngIf="openDropdown() === 'month'" (click)="$event.stopPropagation()">
              <input class="menu-search-input" [ngModel]="searchMonth()" (ngModelChange)="searchMonth.set($event)" placeholder="Search month…" (click)="$event.stopPropagation()" />
              <div class="menu-options-list">
                <div class="menu-option-item" [class.selected]="selectedMonths().length === 0" (click)="toggleMonth('')">
                  <input type="checkbox" [checked]="selectedMonths().length === 0" (click)="$event.stopPropagation()" (change)="toggleMonth('')" style="margin-right: 8px;" />
                  <span>All Months</span>
                </div>
                <div class="menu-option-item" *ngFor="let m of filteredMonths()" [class.selected]="isMonthSelected(m.val)" (click)="toggleMonth(m.val, $event)">
                  <input type="checkbox" [checked]="isMonthSelected(m.val)" (click)="$event.stopPropagation()" (change)="toggleMonth(m.val)" style="margin-right: 8px;" />
                  <span>{{ m.name }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 6. Date Dropdown (Multi-select) -->
          <div class="filter-item">
            <label class="filter-label">Date</label>
            <div class="dropdown-trigger" [class.active-filter]="selectedDates().length > 0" (click)="toggleDropdown('date', $event)">
              <span class="trigger-text">{{ getDateLabel() }}</span>
              <button *ngIf="selectedDates().length > 0" type="button" class="trigger-clear-btn" (click)="toggleDate('', $event)" title="Clear Date filter">
                <svg viewBox="0 0 24 24" width="11" height="11" stroke="currentColor" stroke-width="2.5" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
              <span class="trigger-caret">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </span>
            </div>
            <div class="dropdown-menu-pop pop-right" *ngIf="openDropdown() === 'date'" (click)="$event.stopPropagation()">
              <input class="menu-search-input" [ngModel]="searchDate()" (ngModelChange)="searchDate.set($event)" placeholder="Search date…" (click)="$event.stopPropagation()" />
              <div class="menu-options-list">
                <div class="menu-option-item" [class.selected]="selectedDates().length === 0" (click)="toggleDate('')">
                  <input type="checkbox" [checked]="selectedDates().length === 0" (click)="$event.stopPropagation()" (change)="toggleDate('')" style="margin-right: 8px;" />
                  <span>All Dates</span>
                </div>
                <div class="menu-option-item" *ngFor="let d of filteredDates()" [class.selected]="isDateSelected(d)" (click)="toggleDate(d, $event)">
                  <input type="checkbox" [checked]="isDateSelected(d)" (click)="$event.stopPropagation()" (change)="toggleDate(d)" style="margin-right: 8px;" />
                  <span>{{ d }}</span>
                </div>
                <div *ngIf="!filteredDates().length" style="padding:8px 12px; font-size:12px; color:#1e40af;">No dates found</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── 2. Top Overview KPI Cards (Main Page: 5 cards | User Page: 4 cards) ── -->
      <div class="kpi-grid" [class.four-cols]="selectedUserEmail()">
        <div class="kpi-card blue-1">
          <div class="kpi-label">{{ selectedUserEmail() ? 'User Total Views' : 'Total Views' }}</div>
          <div class="kpi-value">{{ (analytics()?.kpis?.totalViews || 0) | number }}</div>
        </div>

        <div class="kpi-card blue-2" *ngIf="!selectedUserEmail()">
          <div class="kpi-label">Active Viewers</div>
          <div class="kpi-value">{{ (analytics()?.kpis?.totalViewers || 0) | number }}</div>
        </div>

        <div class="kpi-card blue-3">
          <div class="kpi-label">{{ selectedUserEmail() ? 'Reports Accessed' : 'Reports & Dashboards' }}</div>
          <div class="kpi-value">{{ (analytics()?.kpis?.totalReports || 0) | number }}</div>
        </div>

        <div class="kpi-card blue-4">
          <div class="kpi-label">{{ selectedUserEmail() ? 'Pages Visited' : (filterReportName ? 'Tracked Pages' : 'Tracked Pages') }}</div>
          <div class="kpi-value">{{ (analytics()?.kpis?.totalPages || 0) | number }}</div>
        </div>

        <div class="kpi-card blue-5" *ngIf="!selectedUserEmail()">
          <div class="kpi-label">Unused Access Watchlist</div>
          <div class="kpi-value">
            {{ accessData()?.unusedUsers || 0 }} <span style="font-size:16px; font-weight:600; color:#1e40af;">/ {{ accessData()?.totalUsers || 0 }}</span>
          </div>
        </div>

        <div class="kpi-card blue-5" *ngIf="selectedUserEmail()">
          <div class="kpi-label">Most Active Report</div>
          <div class="kpi-value" style="font-size:18px; line-height:1.2;">
            {{ analytics()?.kpis?.topReport?.name || 'N/A' }}
          </div>
          <div class="kpi-sub">{{ (analytics()?.kpis?.topReport?.views || 0) | number }} views</div>
        </div>
      </div>

      <!-- ── 3. Overview Visuals (Yellow Monthly Graph + Blue Pie) ── -->
      <div class="overview-charts-grid">

        <!-- Left: Monthly View Activity Graph (Yellow Bars) -->
        <div class="card-outlined">
          <div class="card-header-row">
            <h3 class="card-title">{{ selectedUserEmail() ? 'User Monthly Activity' : 'Monthly View Activity' }}</h3>
            <span style="font-size:13px; font-weight:600; color:#1e3a8a;">
              {{ monthlyTimelineData().length }} Active Month{{ monthlyTimelineData().length === 1 ? '' : 's' }}
            </span>
          </div>

          <div class="monthly-chart-wrap" *ngIf="monthlyTimelineData().length; else noMonthly">
            <div class="monthly-bars-container">
              <div class="monthly-bar-col" *ngFor="let m of monthlyTimelineData()" [title]="m.label + ': ' + (m.views | number) + ' views'">
                <div class="monthly-bar-val">{{ m.views | number }}</div>
                <div class="monthly-bar-pill" [style.height.%]="monthlyBarHeightPct(m.views)"></div>
                <div class="monthly-bar-lbl" [title]="m.label">{{ m.shortLabel }}</div>
              </div>
            </div>
          </div>
          <ng-template #noMonthly>
            <div style="color:#1e40af; font-size:13px; text-align:center; padding:50px 0;">
              No monthly view activity recorded.
            </div>
          </ng-template>
        </div>

        <!-- Right: Big Blue Pie / Donut Chart (Dynamically Dashboards or Pages) -->
        <div class="card-outlined">
          <div class="card-header-row">
            <h3 class="card-title">{{ selectedUserEmail() ? (filterReportName ? 'User Page Usage Share' : 'User Dashboard Usage Share') : (filterReportName ? 'Page Usage Distribution' : 'Dashboard Usage Distribution') }}</h3>
            <span style="font-size:13px; font-weight:600; color:#1e3a8a;">
              {{ filterReportName ? 'Top Pages Share' : 'Top Dashboards Share' }}
            </span>
          </div>

          <div class="donut-overview-container" *ngIf="pieChartData().length; else noPie">
            <div class="donut-circle-wrap" [style.background]="pieGradient()">
              <div class="donut-hole">
                <div class="donut-hole-val">{{ (analytics()?.kpis?.totalViews || 0) | number }}</div>
                <div class="donut-hole-lbl">Total Views</div>
              </div>
            </div>

            <!-- Clean legend with views in black -->
            <div class="donut-legend">
              <div class="legend-row" *ngFor="let s of pieChartData()">
                <div class="legend-left">
                  <div class="legend-dot" [style.background]="s.color"></div>
                  <span class="legend-name" [title]="s.name">{{ s.name }}</span>
                </div>
                <span class="legend-views">{{ s.views | number }} views</span>
              </div>
            </div>
          </div>
          <ng-template #noPie>
            <div style="color:#1e40af; font-size:13px; text-align:center; padding:50px 0;">
              No distribution data available.
            </div>
          </ng-template>
        </div>

      </div>

      <!-- ── 4A. MAIN DASHBOARD DETAILED BREAKDOWN: TABBED CARD (when NO user is selected) ── -->
      <div class="unified-breakdown-card" *ngIf="!selectedUserEmail()">

        <!-- Top Bar: Segmented Tabs [ Dashboards / Pages | People | Access ] + Search & Sub-filters -->
        <div class="breakdown-top-bar">
          <div class="segmented-tabs">
            <button class="segmented-tab" [class.active]="activeBreakdownTab() === 'pages'" (click)="activeBreakdownTab.set('pages'); pageCurrentPage.set(1); reportCurrentPage.set(1);">
              {{ filterReportName ? 'Pages' : 'Dashboards' }}
            </button>
            <button class="segmented-tab" [class.active]="activeBreakdownTab() === 'people'" (click)="activeBreakdownTab.set('people'); userCurrentPage.set(1);">
              People
            </button>
            <button class="segmented-tab" [class.active]="activeBreakdownTab() === 'access'" (click)="activeBreakdownTab.set('access'); accessCurrentPage.set(1);">
              Access
            </button>
          </div>

          <!-- Controls when Tab 1 is active and no report filter is applied (Dashboard Breakdown) -->
          <div style="display:flex; align-items:center; gap:8px;" *ngIf="activeBreakdownTab() === 'pages' && !filterReportName">
            <select class="breakdown-search-input" [ngModel]="reportSortOrder()" (ngModelChange)="reportSortOrder.set($event); reportCurrentPage.set(1);" style="width:115px; cursor:pointer;">
              <option value="views-desc">Top Views</option>
              <option value="views-asc">Least Views</option>
              <option value="name-asc">A to Z</option>
            </select>
            <input class="breakdown-search-input" [ngModel]="reportSearchText()" (ngModelChange)="reportSearchText.set($event); reportCurrentPage.set(1);" placeholder="Search dashboard…" style="width:170px;" />
          </div>

          <!-- Controls when Tab 1 is active and a report IS selected (Page Breakdown) -->
          <div style="display:flex; align-items:center; gap:8px;" *ngIf="activeBreakdownTab() === 'pages' && filterReportName">
            <select class="breakdown-search-input" [ngModel]="pageSortOrder()" (ngModelChange)="pageSortOrder.set($event); pageCurrentPage.set(1);" style="width:115px; cursor:pointer;">
              <option value="views-desc">Top Views</option>
              <option value="views-asc">Least Views</option>
              <option value="name-asc">A to Z</option>
            </select>
            <input class="breakdown-search-input" [ngModel]="pageSearchText()" (ngModelChange)="pageSearchText.set($event); pageCurrentPage.set(1);" placeholder="Search pages…" style="width:160px;" />
          </div>

          <!-- Controls for People tab -->
          <div *ngIf="activeBreakdownTab() === 'people'">
            <input class="breakdown-search-input" [ngModel]="userSearchText()" (ngModelChange)="userSearchText.set($event); userCurrentPage.set(1);" placeholder="Search user…" style="width:160px;" />
          </div>

          <!-- Controls for Access tab -->
          <div *ngIf="activeBreakdownTab() === 'access'">
            <input class="breakdown-search-input" [ngModel]="accessSearchText()" (ngModelChange)="accessSearchText.set($event); accessCurrentPage.set(1)" placeholder="Search member…" style="width:190px;" />
          </div>
        </div>

        <!-- ── TAB 1: DASHBOARDS VIEW (When NO report filter is active) ── -->
        <ng-container *ngIf="activeBreakdownTab() === 'pages' && !filterReportName">
          <div class="breakdown-subtitle">
            {{ filteredReportUsage().length }} dashboards tracked
          </div>

          <div class="breakdown-list-container" *ngIf="pagedReports().length; else noDashboards">
            <div class="breakdown-row-item interactive" *ngFor="let r of pagedReports(); let idx = index" (click)="selectReport(r.reportName)" [title]="'Click to view page breakdown for ' + r.reportName">
              <div style="display:flex; align-items:center; gap:16px; min-width:0; flex:1;">
                <span class="row-rank-tag">#{{ (reportCurrentPage() - 1) * 5 + idx + 1 }}</span>
                <div style="min-width:0; flex:1;">
                  <div class="row-primary-title" [title]="r.reportName">{{ r.reportName }}</div>
                  <div class="row-secondary-info" *ngIf="r.groupName" style="margin-top:2px;">
                    <span style="color:#1d4ed8; font-weight:600;">{{ r.groupName }}</span>
                  </div>
                </div>
              </div>

              <div class="row-metric-box">
                <div class="row-metric-val">{{ r.views | number }}</div>
                <div class="row-metric-sub">views</div>
              </div>
            </div>
          </div>
          <ng-template #noDashboards>
            <div style="color:#94a3b8; font-size:13px; text-align:center; padding:35px 0;">
              No dashboards match current search.
            </div>
          </ng-template>
        </ng-container>

        <!-- ── TAB 1: PAGES VIEW (When a specific report IS selected) ── -->
        <ng-container *ngIf="activeBreakdownTab() === 'pages' && filterReportName">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-top:8px; margin-bottom:6px; padding:6px 12px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px;">
            <div style="display:flex; align-items:center; gap:8px; font-size:12.5px; color:#1e40af; min-width:0;">
              <span style="font-weight:600; color:#64748b;">Filtered Dashboard:</span>
              <span style="font-weight:700; color:#1d4ed8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" [title]="filterReportName">{{ filterReportName }}</span>
            </div>
            <button type="button" class="btn-card-nav" (click)="selectReport('')" style="display:flex; align-items:center; gap:4px; font-size:11.5px; padding:3px 10px; cursor:pointer;" title="View all dashboards">
              <span>✕ View All Dashboards</span>
            </button>
          </div>

          <div class="breakdown-subtitle">
            {{ filteredPageUsage().length }} pages tracked for {{ filterReportName }}, ranked by views
          </div>

          <div class="breakdown-list-container" *ngIf="pagedPages().length; else noPages">
            <div class="breakdown-row-item" *ngFor="let p of pagedPages(); let idx = index">
              <div style="display:flex; align-items:center; gap:16px; min-width:0; flex:1;">
                <span class="row-rank-tag">#{{ (pageCurrentPage() - 1) * 5 + idx + 1 }}</span>
                <div style="min-width:0; flex:1;">
                  <div class="row-primary-title" [title]="p.pageName">{{ p.pageName }}</div>
                  <div class="row-secondary-info" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:2px;">
                    <span *ngIf="p.reportName" style="color:#1d4ed8; font-weight:600;">Report - {{ p.reportName }}</span>
                    <span *ngIf="p.reportName" style="opacity:0.4;">•</span>
                    <span>{{ p.viewers }} viewer{{ p.viewers === 1 ? '' : 's' }}</span>
                  </div>
                </div>
              </div>

              <div class="row-metric-box">
                <div class="row-metric-val">{{ p.views | number }}</div>
                <div class="row-metric-sub">views · {{ formatAccessDate(p.lastAccessed) }}</div>
              </div>
            </div>
          </div>
          <ng-template #noPages>
            <div style="color:#94a3b8; font-size:13px; text-align:center; padding:35px 0;">
              No pages match current search.
            </div>
          </ng-template>
        </ng-container>

        <!-- ── TAB 2: PEOPLE VIEW ── -->
        <ng-container *ngIf="activeBreakdownTab() === 'people'">
          <div class="breakdown-subtitle">
            {{ filteredUserUsage().length }} users, most active first
          </div>

          <div class="breakdown-list-container" *ngIf="pagedUsers().length; else noUsers">
            <div class="breakdown-row-item interactive" *ngFor="let u of pagedUsers(); let i = index" (click)="navigateToUser(u.email)" title="Click to view detailed analytics for {{ u.name }}">
              <div style="display:flex; align-items:center; gap:14px; min-width:0; flex:1;">
                <div class="user-avatar"
                     [style.background]="getUserAvatarStyle(u.name, i).bg"
                     [style.color]="getUserAvatarStyle(u.name, i).color">
                  {{ getUserInitial(u.name) }}
                </div>
                <div style="min-width:0; flex:1;">
                  <div class="row-primary-title" [title]="u.name">{{ u.name }}</div>
                  <div class="row-secondary-info">{{ u.email }} · {{ u.pagesCount }} page{{ u.pagesCount === 1 ? '' : 's' }}</div>
                </div>
              </div>

              <div class="row-metric-box">
                <div class="row-metric-val">{{ u.views | number }}</div>
                <div class="row-metric-sub">{{ formatAccessDate(u.lastAccessed) }}</div>
              </div>
            </div>
          </div>
          <ng-template #noUsers>
            <div style="color:#94a3b8; font-size:13px; text-align:center; padding:35px 0;">
              No users match current search.
            </div>
          </ng-template>
        </ng-container>

        <!-- ── TAB 3: ACCESS AUDIT VIEW ── -->
        <ng-container *ngIf="activeBreakdownTab() === 'access'">
          <div class="access-sub-bar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
            <div class="access-pill-tabs">
              <button class="access-pill-btn" [class.active]="accessFilterTab() === 'all'" (click)="accessFilterTab.set('all'); accessCurrentPage.set(1);" title="All Members">
                All ({{ accessData()?.totalUsers || 0 }})
              </button>
              <button class="access-pill-btn" [class.active]="accessFilterTab() === 'unused'" (click)="accessFilterTab.set('unused'); accessCurrentPage.set(1);" style="color:#b45309;" title="Unused Access">
                Unused ({{ accessData()?.unusedUsers || 0 }})
              </button>
              <button class="access-pill-btn" [class.active]="accessFilterTab() === 'active'" (click)="accessFilterTab.set('active'); accessCurrentPage.set(1);" title="Active Members">
                Active ({{ accessData()?.activeUsers || 0 }})
              </button>
            </div>

            <div style="display:flex; align-items:center; gap:12px;">
              <span style="font-size:12.5px; color:#64748b; font-weight:500;">
                {{ filteredAccessList().length }} members audited
              </span>
              <button class="btn-back" style="font-size:12px; padding:6px 14px; border-color:#cbd5e1; background:#ffffff; color:#0f172a;" (click)="exportAccessMatrixCSV()">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                Export Access Matrix CSV
              </button>
            </div>
          </div>

          <div class="breakdown-list-container" *ngIf="pagedAccessList().length; else noAccessUsers">
            <div class="breakdown-row-item" [class.interactive]="u.views > 0" *ngFor="let u of pagedAccessList(); let i = index" (click)="u.views > 0 ? navigateToUser(u.email) : null" [title]="u.views > 0 ? 'Click to view analytics for ' + u.displayName : ''">
              <div style="display:flex; align-items:center; gap:14px; min-width:0; flex:1;">
                <div class="user-avatar"
                     [style.background]="getUserAvatarStyle(u.displayName, i).bg"
                     [style.color]="getUserAvatarStyle(u.displayName, i).color">
                  {{ getUserInitial(u.displayName) }}
                </div>
                <div style="min-width:0; flex:1;">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <div class="row-primary-title" [title]="u.displayName">{{ u.displayName }}</div>
                    <span class="role-badge" [ngClass]="getRoleBadgeClass(u.role)">{{ u.role }}</span>
                  </div>
                  <div class="row-secondary-info">{{ u.email }}</div>
                </div>
              </div>

              <div class="row-metric-box">
                <div class="row-metric-val">{{ u.views | number }}</div>
                <div class="row-metric-sub">
                  <span *ngIf="u.status === 'active'">{{ formatAccessDate(u.lastAccessed) }}</span>
                  <span *ngIf="u.status !== 'active'" style="color:#dc2626; font-weight:600;">{{ u.lastAccessed ? formatAccessDate(u.lastAccessed) : 'Never active' }}</span>
                </div>
              </div>
            </div>
          </div>
          <ng-template #noAccessUsers>
            <div style="color:#94a3b8; font-size:13px; text-align:center; padding:35px 0;">
              No members match current access filters.
            </div>
          </ng-template>
        </ng-container>

      </div>

      <!-- ── 4B. USER DETAIL FULL-WIDTH PAGE BREAKDOWN ── -->
      <div class="card-outlined" *ngIf="selectedUserEmail()">
        <div class="card-header-row">
          <div>
            <h3 class="card-title">Pages Viewed by {{ currentUserObject()?.name || selectedUserEmail() }}</h3>
            <div style="font-size:13px; color:#1e3a8a; margin-top:2px;">
              {{ filteredPageUsage().length }} page{{ filteredPageUsage().length === 1 ? '' : 's' }} visited
            </div>
          </div>

          <div style="display:flex; align-items:center; gap:10px;">
            <input class="search-mini-input" [ngModel]="pageSearchText()" (ngModelChange)="pageSearchText.set($event); pageCurrentPage.set(1);" placeholder="Search visited pages…" style="width:200px;" />
            <select class="search-mini-input" [ngModel]="pageSortOrder()" (ngModelChange)="pageSortOrder.set($event); pageCurrentPage.set(1);" style="width:125px; cursor:pointer;">
              <option value="views-desc">Top Views</option>
              <option value="views-asc">Least Views</option>
              <option value="name-asc">A to Z</option>
            </select>
          </div>
        </div>

        <div class="page-diagram-list" *ngIf="pagedPages().length; else noUserPages">
          <div class="page-clean-row" *ngFor="let p of pagedPages(); let idx = index">
            <div class="page-title-group">
              <span class="page-rank-pill" *ngIf="pageSortOrder() === 'views-desc'">#{{ (pageCurrentPage() - 1) * 5 + idx + 1 }}</span>
              <div style="min-width:0; flex:1;">
                <div class="page-name" [title]="p.pageName">{{ p.pageName }}</div>
                <div class="page-report-tag" *ngIf="p.reportName" [title]="p.reportName">
                  Report - <strong>{{ p.reportName }}</strong>
                </div>
              </div>
            </div>
            <div class="page-stats-right">
              <span class="page-views-num">{{ p.views | number }} views</span>
            </div>
          </div>

          <!-- User Pages Pagination Controls -->
          <div class="pagination-bar" *ngIf="filteredPageUsage().length > 5">
            <span class="pagination-info">
              {{ (pageCurrentPage() - 1) * 5 + 1 }}–{{ Math.min(pageCurrentPage() * 5, filteredPageUsage().length) }} of {{ filteredPageUsage().length }} visited pages
            </span>
            <div class="pagination-controls">
              <button class="btn-page" [disabled]="pageCurrentPage() === 1" (click)="pageCurrentPage.set(pageCurrentPage() - 1)">
                Previous
              </button>
              <span class="page-current-pill">
                Page {{ pageCurrentPage() }} of {{ pageTotalPages() }}
              </span>
              <button class="btn-page" [disabled]="pageCurrentPage() >= pageTotalPages()" (click)="pageCurrentPage.set(pageCurrentPage() + 1)">
                Next
              </button>
            </div>
          </div>
        </div>
        <ng-template #noUserPages>
          <div style="color:#1e40af; font-size:13px; text-align:center; padding:35px 0;">
            No visited pages match the search criteria.
          </div>
        </ng-template>
      </div>
    </div>
  `,
})
export class UsageComponent implements OnInit {
  analytics = signal<DashboardAnalyticsResponse | null>(null);
  accessData = signal<AccessUtilizationResponse | null>(null);
  loading = signal(false);

  // Selected user for dedicated User Analytics view
  selectedUserEmail = signal<string>('');

  // 6 Filter models
  filterGroupId: string = '';
  filterReportName: string = '';
  filterUserEmail: string = '';
  filterYear: string = '';
  filterMonth: string = '';
  filterDate: string = '';

  // Dropdown open state
  openDropdown = signal<string | null>(null);

  // Search inside dropdowns
  searchWs = signal<string>('');
  searchRep = signal<string>('');
  searchUser = signal<string>('');
  searchYear = signal<string>('');
  searchMonth = signal<string>('');
  searchDate = signal<string>('');

  // Breakdown active tab ('pages' | 'people' | 'access')
  activeBreakdownTab = signal<'pages' | 'people' | 'access'>('pages');

  // In-page search & sorting for Dashboard breakdown
  reportSearchText = signal<string>('');
  reportSortOrder = signal<'views-desc' | 'views-asc' | 'name-asc'>('views-desc');
  reportCurrentPage = signal<number>(1);

  // In-page search & sorting for Page breakdown
  pageSearchText = signal<string>('');
  pageSortOrder = signal<'views-desc' | 'views-asc' | 'name-asc'>('views-desc');
  pageCurrentPage = signal<number>(1);

  // In-page search for People & Access
  userSearchText = signal<string>('');
  userCurrentPage = signal<number>(1);

  accessFilterTab = signal<'all' | 'unused' | 'active'>('all');
  accessSearchText = signal<string>('');
  accessCurrentPage = signal<number>(1);

  // Expose Math for template
  Math = Math;

  // Close dropdowns on outside click
  @HostListener('document:click', ['$event'])
  onDocumentClick() {
    this.openDropdown.set(null);
  }

  toggleDropdown(name: string, event: MouseEvent) {
    event.stopPropagation();
    if (this.openDropdown() === name) {
      this.openDropdown.set(null);
    } else {
      this.openDropdown.set(name);
    }
  }

  isServicePrincipal(displayName: string = '', email: string = ''): boolean {
    const disp = (displayName || '').toLowerCase();
    const em = (email || '').toLowerCase();
    const isGuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
    return (
      disp.includes('serviceprincipal') ||
      disp.includes('powerbi-api') ||
      em.includes('powerbi-api') ||
      em.includes('serviceprincipal') ||
      isGuid(disp) ||
      isGuid(em) ||
      isGuid(em.split('@')[0])
    );
  }

  // Filter options derived from analytics
  availableWorkspaces = computed(() => this.analytics()?.filterOptions?.workspaces || []);
  availableReports = computed(() => this.analytics()?.filterOptions?.reports || []);
  availableUsers = computed(() => (this.analytics()?.filterOptions?.users || []).filter(u => !this.isServicePrincipal(u.name, u.email)));
  availableYears = computed(() => this.analytics()?.filterOptions?.years || []);
  availableDates = computed(() => this.analytics()?.filterOptions?.dates || []);

  currentUserObject = computed(() => {
    const email = this.selectedUserEmail();
    if (!email) return null;
    return this.availableUsers().find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
  });

  // Filtered dropdown lists based on user search in dropdown
  filteredWorkspaces = computed(() => {
    const raw = this.availableWorkspaces();
    const s = (this.searchWs() || '').toLowerCase().trim();
    return s ? raw.filter(w => (w.groupName || '').toLowerCase().includes(s)) : raw;
  });

  filteredReports = computed(() => {
    const raw = this.availableReports();
    const s = (this.searchRep() || '').toLowerCase().trim();
    return s ? raw.filter(r => (r.reportName || '').toLowerCase().includes(s)) : raw;
  });

  filteredUsers = computed(() => {
    const raw = this.availableUsers();
    const s = (this.searchUser() || '').toLowerCase().trim();
    return s ? raw.filter(u => (u.name || '').toLowerCase().includes(s) || (u.email || '').toLowerCase().includes(s)) : raw;
  });

  filteredYears = computed(() => {
    const raw = this.availableYears();
    const s = (this.searchYear() || '').trim();
    return s ? raw.filter(y => String(y).includes(s)) : raw;
  });

  allMonthsList = [
    { val: '1', name: 'January' },
    { val: '2', name: 'February' },
    { val: '3', name: 'March' },
    { val: '4', name: 'April' },
    { val: '5', name: 'May' },
    { val: '6', name: 'June' },
    { val: '7', name: 'July' },
    { val: '8', name: 'August' },
    { val: '9', name: 'September' },
    { val: '10', name: 'October' },
    { val: '11', name: 'November' },
    { val: '12', name: 'December' },
  ];

  filteredMonths = computed(() => {
    const s = (this.searchMonth() || '').toLowerCase().trim();
    return s ? this.allMonthsList.filter(m => m.name.toLowerCase().includes(s)) : this.allMonthsList;
  });

  filteredDates = computed(() => {
    const raw = this.availableDates();
    const s = (this.searchDate() || '').trim();
    return s ? raw.filter(d => String(d).includes(s)) : raw;
  });

  // Multi-select Signals
  selectedWorkspaces = signal<string[]>([]);
  selectedReports = signal<string[]>([]);
  selectedUsers = signal<string[]>([]);
  selectedYears = signal<string[]>([]);
  selectedMonths = signal<string[]>([]);
  selectedDates = signal<string[]>([]);

  // Dropdown Label Helpers
  getWorkspaceLabel(): string {
    const sel = this.selectedWorkspaces();
    if (!sel || sel.length === 0) return 'All Workspaces';
    if (sel.length === 1) {
      return this.availableWorkspaces().find(w => w.groupId === sel[0])?.groupName || '1 Workspace';
    }
    if (sel.length <= 2) {
      return sel.map(id => this.availableWorkspaces().find(w => w.groupId === id)?.groupName || id).join(', ');
    }
    return `${sel.length} Workspaces Selected`;
  }

  getReportLabel(): string {
    const sel = this.selectedReports();
    if (!sel || sel.length === 0) return 'All Reports & Dashboards';
    if (sel.length === 1) return sel[0];
    if (sel.length <= 2) return sel.join(', ');
    return `${sel.length} Reports Selected`;
  }

  getUserLabel(): string {
    const sel = this.selectedUsers();
    if (!sel || sel.length === 0) return 'All Users';
    if (sel.length === 1) {
      const match = this.availableUsers().find(u => u.email.toLowerCase() === sel[0].toLowerCase());
      return match ? (match.name || match.email) : sel[0];
    }
    if (sel.length <= 2) {
      return sel.map(em => {
        const m = this.availableUsers().find(u => u.email.toLowerCase() === em.toLowerCase());
        return m ? (m.name || m.email) : em;
      }).join(', ');
    }
    return `${sel.length} Users Selected`;
  }

  getYearLabel(): string {
    const sel = this.selectedYears();
    if (!sel || sel.length === 0) return 'All Years';
    if (sel.length === 1) return sel[0];
    return sel.join(', ');
  }

  getMonthLabel(): string {
    const selected = this.selectedMonths();
    if (!selected || selected.length === 0) return 'All Months';
    if (selected.length === 1) {
      return this.allMonthsList.find(m => m.val === selected[0])?.name || 'Selected Month';
    }
    if (selected.length <= 3) {
      return selected
        .map(v => this.allMonthsList.find(m => m.val === v)?.name?.slice(0, 3))
        .filter(Boolean)
        .join(', ');
    }
    return `${selected.length} Months Selected`;
  }

  getDateLabel(): string {
    const sel = this.selectedDates();
    if (!sel || sel.length === 0) return 'All Dates';
    if (sel.length === 1) return sel[0];
    if (sel.length <= 2) return sel.join(', ');
    return `${sel.length} Dates Selected`;
  }

  // Check Helpers
  isWorkspaceSelected(id: string): boolean { return this.selectedWorkspaces().includes(id); }
  isReportSelected(name: string): boolean { return this.selectedReports().includes(name); }
  isUserSelected(email: string): boolean { return this.selectedUsers().map(e => e.toLowerCase()).includes(email.toLowerCase()); }
  isYearSelected(yr: string): boolean { return this.selectedYears().includes(yr); }
  isMonthSelected(val: string): boolean { return this.selectedMonths().includes(val); }
  isDateSelected(d: string): boolean { return this.selectedDates().includes(d); }

  // Toggle Handlers
  toggleWorkspace(id: string, event?: MouseEvent) {
    if (event) event.stopPropagation();
    if (!id) {
      this.selectedWorkspaces.set([]);
      this.filterGroupId = '';
    } else {
      const cur = this.selectedWorkspaces();
      const updated = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id];
      this.selectedWorkspaces.set(updated);
      this.filterGroupId = updated.join(',');
    }
    this.reportCurrentPage.set(1);
    this.pageCurrentPage.set(1);
    this.onFilterChanged();
  }

  toggleReport(name: string, event?: MouseEvent) {
    if (event) event.stopPropagation();
    if (!name) {
      this.selectedReports.set([]);
      this.filterReportName = '';
    } else {
      const cur = this.selectedReports();
      const updated = cur.includes(name) ? cur.filter(x => x !== name) : [...cur, name];
      this.selectedReports.set(updated);
      this.filterReportName = updated.join(',');
    }
    this.pageCurrentPage.set(1);
    this.onFilterChanged();
  }

  toggleUser(email: string, event?: MouseEvent) {
    if (event) event.stopPropagation();
    if (!email) {
      this.selectedUsers.set([]);
      this.filterUserEmail = '';
      this.selectedUserEmail.set('');
    } else {
      const cur = this.selectedUsers();
      const lower = email.toLowerCase();
      const updated = cur.map(e=>e.toLowerCase()).includes(lower) ? cur.filter(x => x.toLowerCase() !== lower) : [...cur, email];
      this.selectedUsers.set(updated);
      this.filterUserEmail = updated.join(',');
      if (updated.length === 1) this.selectedUserEmail.set(updated[0]);
      else this.selectedUserEmail.set('');
    }
    this.onFilterChanged();
  }

  toggleYear(yr: string, event?: MouseEvent) {
    if (event) event.stopPropagation();
    if (!yr) {
      this.selectedYears.set([]);
      this.filterYear = '';
    } else {
      const cur = this.selectedYears();
      const updated = cur.includes(yr) ? cur.filter(x => x !== yr) : [...cur, yr];
      this.selectedYears.set(updated);
      this.filterYear = updated.join(',');
    }
    this.onFilterChanged();
  }

  toggleMonth(val: string, event?: MouseEvent) {
    if (event) event.stopPropagation();
    if (!val) {
      this.selectedMonths.set([]);
      this.filterMonth = '';
    } else {
      const cur = this.selectedMonths();
      const updated = cur.includes(val) ? cur.filter(x => x !== val) : [...cur, val];
      this.selectedMonths.set(updated);
      this.filterMonth = updated.join(',');
    }
    this.onFilterChanged();
  }

  toggleDate(d: string, event?: MouseEvent) {
    if (event) event.stopPropagation();
    if (!d) {
      this.selectedDates.set([]);
      this.filterDate = '';
    } else {
      const cur = this.selectedDates();
      const updated = cur.includes(d) ? cur.filter(x => x !== d) : [...cur, d];
      this.selectedDates.set(updated);
      this.filterDate = updated.join(',');
    }
    this.onFilterChanged();
  }

  selectWorkspace(id: string) { this.toggleWorkspace(id); }
  selectReport(name: string) { this.toggleReport(name); }
  selectUser(email: string) { this.toggleUser(email); }
  selectYear(yr: string) { this.toggleYear(yr); }
  selectMonth(m: string) { this.toggleMonth(m); }
  selectDate(d: string) { this.toggleDate(d); }

  exportAccessMatrixCSV() {
    const reports = this.filteredReportUsage() || [];
    const pages = this.filteredPageUsage() || [];
    const members = this.filteredAccessList() || [];

    if (reports.length === 0 && pages.length === 0 && members.length === 0) {
      this.toast.error('No report or user access records available for export.');
      return;
    }

    const escape = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const dateColTitle = this.filterDate ? 'Date' : 'Date / Activity Date';
    const viewsColTitle = this.filterDate ? 'Day Views' : 'Views';

    const csvLines: string[] = [];

    // Header Metadata
    csvLines.push(`${escape('POWER BI USAGE & ACCESS REPORT (DATE-WISE)')}`);
    csvLines.push(`${escape('Export Date')},${escape(new Date().toISOString().slice(0, 10))}`);
    if (this.filterGroupId) csvLines.push(`${escape('Workspace Filter')},${escape(this.filterGroupId)}`);
    if (this.filterReportName) csvLines.push(`${escape('Report/Dashboard Filter')},${escape(this.filterReportName)}`);
    if (this.filterUserEmail || this.selectedUserEmail()) csvLines.push(`${escape('User Filter')},${escape(this.filterUserEmail || this.selectedUserEmail())}`);
    if (this.filterYear) csvLines.push(`${escape('Year Filter')},${escape(this.filterYear)}`);
    if (this.filterMonth) csvLines.push(`${escape('Month Filter')},${escape(this.filterMonth)}`);
    if (this.filterDate) csvLines.push(`${escape('Date Filter')},${escape(this.filterDate)}`);
    csvLines.push('');

    // SECTION 1: DASHBOARDS & REPORTS USAGE
    csvLines.push(`${escape('=== SECTION 1: DASHBOARDS & REPORTS USAGE ===')}`);
    csvLines.push([
      escape('Date'),
      escape('Workspace'),
      escape('Report / Dashboard Name'),
      escape('Total Pages'),
      escape('Unique Viewers'),
      escape(viewsColTitle)
    ].join(','));

    for (const r of reports) {
      csvLines.push([
        escape(this.filterDate || (r.lastAccessed ? this.formatAccessDate(r.lastAccessed) : 'All Dates')),
        escape(r.groupName || 'Workspace'),
        escape(r.reportName),
        r.pagesCount || 0,
        r.viewers || 0,
        r.views || 0
      ].join(','));
    }
    csvLines.push('');

    // SECTION 2: PAGE & TAB USAGE BREAKDOWN
    csvLines.push(`${escape('=== SECTION 2: PAGE & TAB USAGE BREAKDOWN ===')}`);
    csvLines.push([
      escape('Date'),
      escape('Report / Dashboard Name'),
      escape('Page Name'),
      escape('Unique Viewers'),
      escape(viewsColTitle)
    ].join(','));

    for (const p of pages) {
      csvLines.push([
        escape(this.filterDate || (p.lastAccessed ? this.formatAccessDate(p.lastAccessed) : 'All Dates')),
        escape(p.reportName),
        escape(p.pageName),
        p.viewers || 0,
        p.views || 0
      ].join(','));
    }
    csvLines.push('');

    // SECTION 3: USER ACCESS & ACTIVITY AUDIT
    csvLines.push(`${escape('=== SECTION 3: USER ACCESS & ACTIVITY AUDIT ===')}`);
    csvLines.push([
      escape('Date / Period'),
      escape('User / Member Name'),
      escape('Email Address'),
      escape('Role / Access Level'),
      escape('Access Status'),
      escape(viewsColTitle)
    ].join(','));

    for (const u of members) {
      csvLines.push([
        escape(this.filterDate || (u.lastAccessed ? this.formatAccessDate(u.lastAccessed) : (u.views > 0 ? 'Active in period' : 'No views in period'))),
        escape(u.displayName || u.email),
        escape(u.email),
        escape(u.role || 'Viewer'),
        escape(u.status === 'active' ? 'Active' : 'Unused'),
        u.views || 0
      ].join(','));
    }

    const csvContent = csvLines.join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);

    const safeFilterSuffix = this.filterReportName 
      ? `_${this.filterReportName.replace(/[^a-zA-Z0-9]/g, '_')}`
      : (this.filterDate ? `_${this.filterDate}` : '');
    link.setAttribute('download', `Usage_Access_Report${safeFilterSuffix}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.toast.success(`Exported CSV sheet according to selected filters.`);
  }



  clearFilter(type: string, event: MouseEvent) {
    event.stopPropagation();
    switch (type) {
      case 'ws':
        this.selectWorkspace('');
        break;
      case 'rep':
        this.selectReport('');
        break;
      case 'user':
        this.clearSelectedUser();
        break;
      case 'year':
        this.selectYear('');
        break;
      case 'month':
        this.selectMonth('');
        break;
      case 'date':
        this.selectDate('');
        break;
    }
  }

  navigateToUser(email: string) {
    this.selectedUserEmail.set(email);
    this.filterUserEmail = email;
    this.reportCurrentPage.set(1);
    this.pageCurrentPage.set(1);
    this.onFilterChanged();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  clearSelectedUser() {
    this.selectedUserEmail.set('');
    this.filterUserEmail = '';
    this.reportCurrentPage.set(1);
    this.pageCurrentPage.set(1);
    this.onFilterChanged();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  activeFilterCount = computed(() => {
    let count = 0;
    if (this.filterGroupId) count++;
    if (this.filterReportName) count++;
    if (this.filterUserEmail) count++;
    if (this.filterYear) count++;
    if (this.filterMonth) count++;
    if (this.filterDate) count++;
    if (this.selectedUserEmail()) count++;
    return count;
  });

  hasAnyActiveFilter = computed(() => {
    return (
      this.activeFilterCount() > 0 ||
      !!this.reportSearchText() ||
      !!this.pageSearchText() ||
      !!this.userSearchText() ||
      !!this.accessSearchText() ||
      !!this.searchWs() ||
      !!this.searchRep() ||
      !!this.searchUser() ||
      !!this.searchYear() ||
      !!this.searchMonth() ||
      !!this.searchDate()
    );
  });

  // Monthly aggregated timeline data
  monthlyTimelineData = computed(() => {
    const raw = this.analytics()?.viewsTimeline || [];
    if (!raw.length) return [];

    const monthMap = new Map<string, { label: string; shortLabel: string; yearMonth: string; views: number }>();
    const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (const item of raw) {
      if (!item.date) continue;
      const parts = item.date.split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const monthIdx = parseInt(parts[1], 10) - 1;
        const key = `${year}-${parts[1]}`;
        const monthStr = shortMonths[monthIdx] || parts[1];
        const label = `${monthStr} ${year}`;
        const shortLabel = `${monthStr} '${year.slice(2)}`;
        const existing = monthMap.get(key);
        if (existing) {
          existing.views += item.views;
        } else {
          monthMap.set(key, { label, shortLabel, yearMonth: key, views: item.views });
        }
      }
    }

    return Array.from(monthMap.values()).sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
  });

  maxMonthlyViews = computed(() => {
    const data = this.monthlyTimelineData();
    return Math.max(...(data.map(d => d.views) || [1]), 1);
  });

  monthlyBarHeightPct(views: number): number {
    return Math.max(8, Math.round((views / this.maxMonthlyViews()) * 100));
  }

  // Filtered Dashboard / Report Usage (when no report is selected)
  filteredReportUsage = computed(() => {
    let raw: ReportUsageItem[] = this.analytics()?.reportUsage || [];
    // Fallback: If backend didn't return reportUsage, derive it from pageUsage
    if (!raw.length && this.analytics()?.pageUsage?.length) {
      const map = new Map<string, { reportName: string; views: number; viewers: Set<string>; pagesCount: Set<string>; lastAccessed: string; groupName?: string }>();
      for (const p of this.analytics()!.pageUsage) {
        const repName = p.reportName || 'Unknown Report';
        const existing = map.get(repName);
        if (existing) {
          existing.views += p.views;
          existing.pagesCount.add(p.pageName);
          if (p.lastAccessed && p.lastAccessed > existing.lastAccessed) {
            existing.lastAccessed = p.lastAccessed;
          }
        } else {
          map.set(repName, {
            reportName: repName,
            views: p.views,
            viewers: new Set<string>(),
            pagesCount: new Set<string>([p.pageName]),
            lastAccessed: p.lastAccessed || ''
          });
        }
      }
      raw = Array.from(map.values()).map(r => ({
        reportName: r.reportName,
        groupName: r.groupName,
        views: r.views,
        viewers: r.viewers.size || 1,
        pagesCount: r.pagesCount.size,
        lastAccessed: r.lastAccessed
      }));
    }

    const search = (this.reportSearchText() || '').toLowerCase().trim();
    const sort = this.reportSortOrder();

    let filtered = raw.filter(r =>
      (!search || r.reportName.toLowerCase().includes(search) || (r.groupName || '').toLowerCase().includes(search))
    );

    if (sort === 'views-asc') {
      filtered = [...filtered].sort((a, b) => a.views - b.views);
    } else if (sort === 'name-asc') {
      filtered = [...filtered].sort((a, b) => a.reportName.localeCompare(b.reportName));
    } else {
      filtered = [...filtered].sort((a, b) => b.views - a.views);
    }

    return filtered;
  });

  reportTotalPages = computed(() => 1);
  pagedReports = computed(() => this.filteredReportUsage());

  // Big Pie / Donut Chart Data in Blue Shades (Dashboards when on main overview without report filter, Pages when user or report filter active)
  pieChartData = computed(() => {
    if (!this.filterReportName && !this.selectedUserEmail()) {
      // Dashboard level distribution for main overview
      const reports = this.filteredReportUsage();
      if (!reports.length) return [];

      const total = reports.reduce((sum, r) => sum + r.views, 0) || 1;
      const topReports = reports.slice(0, 5);
      const otherViews = reports.slice(5).reduce((sum, r) => sum + r.views, 0);

      const blueShades = ['#1e3a8a', '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'];

      const slices = topReports.map((r, idx) => ({
        name: r.reportName,
        views: r.views,
        percent: Math.round((r.views / total) * 100),
        color: blueShades[idx % blueShades.length]
      }));

      if (otherViews > 0) {
        slices.push({
          name: 'Other Dashboards',
          views: otherViews,
          percent: Math.max(1, Math.round((otherViews / total) * 100)),
          color: blueShades[5]
        });
      }
      return slices;
    } else {
      // Page level distribution for the selected dashboard or selected user
      const pages = this.filteredPageUsage();
      if (!pages.length) return [];

      const total = pages.reduce((sum, p) => sum + p.views, 0) || 1;
      const topPages = pages.slice(0, 5);
      const otherViews = pages.slice(5).reduce((sum, p) => sum + p.views, 0);

      const blueShades = ['#1e3a8a', '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'];

      const slices = topPages.map((p, idx) => ({
        name: p.pageName,
        views: p.views,
        percent: Math.round((p.views / total) * 100),
        color: blueShades[idx % blueShades.length]
      }));

      if (otherViews > 0) {
        slices.push({
          name: 'Other Pages',
          views: otherViews,
          percent: Math.max(1, Math.round((otherViews / total) * 100)),
          color: blueShades[5]
        });
      }
      return slices;
    }
  });

  pieGradient = computed(() => {
    const slices = this.pieChartData();
    if (!slices.length) return 'conic-gradient(#eff6ff 0deg 360deg)';

    const total = slices.reduce((sum, s) => sum + s.views, 0) || 1;
    let currentAngle = 0;
    const gradientParts: string[] = [];

    for (const s of slices) {
      const angle = (s.views / total) * 360;
      const endAngle = currentAngle + angle;
      gradientParts.push(`${s.color} ${currentAngle.toFixed(1)}deg ${endAngle.toFixed(1)}deg`);
      currentAngle = endAngle;
    }

    return `conic-gradient(${gradientParts.join(', ')})`;
  });

  // Filtered Page Usage with working dynamic sort reactivity
  filteredPageUsage = computed(() => {
    const raw = this.analytics()?.pageUsage || [];
    const search = (this.pageSearchText() || '').toLowerCase().trim();
    const sort = this.pageSortOrder();

    let filtered = raw.filter(p =>
      (!search || p.pageName.toLowerCase().includes(search) || p.reportName.toLowerCase().includes(search))
    );

    if (sort === 'views-asc') {
      filtered = [...filtered].sort((a, b) => a.views - b.views);
    } else if (sort === 'name-asc') {
      filtered = [...filtered].sort((a, b) => a.pageName.localeCompare(b.pageName));
    } else {
      filtered = [...filtered].sort((a, b) => b.views - a.views);
    }

    return filtered;
  });

  // Page Pagination
  pageTotalPages = computed(() => 1);
  pagedPages = computed(() => this.filteredPageUsage());

  // Filtered User Usage for User-wise Analysis
  filteredUserUsage = computed(() => {
    const raw = this.analytics()?.userUsage || [];
    const search = (this.userSearchText() || '').toLowerCase().trim();
    return raw
      .filter(u => !this.isServicePrincipal(u.name, u.email))
      .filter(u =>
        (!search || u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search))
      );
  });

  // User Pagination
  userTotalPages = computed(() => 1);
  pagedUsers = computed(() => this.filteredUserUsage());

  // Filtered Access List
  filteredAccessList = computed(() => {
    const raw = (this.accessData()?.users || []).filter(u => !this.isServicePrincipal(u.displayName, u.email));
    const tab = this.accessFilterTab();
    const search = (this.accessSearchText() || '').toLowerCase().trim();

    const filtered = raw.filter(u => {
      if (tab === 'unused' && u.status !== 'unused') return false;
      if (tab === 'active' && u.status !== 'active') return false;
      if (search) {
        return (u.displayName || '').toLowerCase().includes(search) || (u.email || '').toLowerCase().includes(search) || (u.role || '').toLowerCase().includes(search);
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'active' ? -1 : 1;
      }
      return b.views - a.views;
    });
  });

  // Access Pagination
  accessTotalPages = computed(() => 1);
  pagedAccessList = computed(() => this.filteredAccessList());

  constructor(private api: SyncApiService, private toast: ToastService) {}

  ngOnInit(): void {
    this.loadAnalytics();
    this.loadAccessUtilization();
  }

  onFilterChanged(): void {
    this.loadAnalytics();
    this.loadAccessUtilization();
  }

  clearAllFilters(): void {
    this.selectedWorkspaces.set([]);
    this.selectedReports.set([]);
    this.selectedUsers.set([]);
    this.selectedYears.set([]);
    this.selectedMonths.set([]);
    this.selectedDates.set([]);
    this.filterGroupId = '';
    this.filterReportName = '';
    this.filterUserEmail = '';
    this.selectedUserEmail.set('');
    this.filterYear = '';
    this.filterMonth = '';
    this.filterDate = '';
    this.searchWs.set('');
    this.searchRep.set('');
    this.searchUser.set('');
    this.searchYear.set('');
    this.searchMonth.set('');
    this.searchDate.set('');
    this.reportSearchText.set('');
    this.pageSearchText.set('');
    this.userSearchText.set('');
    this.accessSearchText.set('');
    this.reportCurrentPage.set(1);
    this.pageCurrentPage.set(1);
    this.userCurrentPage.set(1);
    this.accessCurrentPage.set(1);
    this.openDropdown.set(null);
    this.onFilterChanged();
  }

  private loadAnalytics(): void {
    this.loading.set(true);
    this.api.getDashboardAnalytics({
      groupId: this.filterGroupId || undefined,
      reportName: this.filterReportName || undefined,
      email: this.filterUserEmail || undefined,
      year: this.filterYear || undefined,
      month: this.filterMonth || undefined,
      date: this.filterDate || undefined,
    }).subscribe({
      next: (data) => {
        this.analytics.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error('Failed to load analytics: ' + (err?.message || 'error'));
      },
    });
  }

  resetFilters(): void {
    this.clearAllFilters();
  }

  exportAccessMatrixExcel(): void {
    this.toast.info('Generating multi-sheet Excel workbook…');
    this.api
      .downloadUsageExcel({
        groupId: this.filterGroupId || undefined,
        reportName: this.filterReportName || undefined,
        email: this.filterUserEmail || undefined,
        year: this.filterYear || undefined,
        month: this.filterMonth || undefined,
        date: this.filterDate || undefined,
      })
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `Usage_Analytics_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          this.toast.success('Downloaded multi-sheet Excel sheet (.xlsx).');
        },
        error: (err) => {
          this.toast.error('Failed to download Excel sheet: ' + (err?.message || 'error'));
        },
      });
  }

  private loadAccessUtilization(): void {
    this.api
      .getAccessUtilization(
        this.filterGroupId || undefined,
        this.filterReportName || undefined,
        this.filterYear || undefined,
        this.filterMonth || undefined,
        this.filterDate || undefined,
      )
      .subscribe({
        next: (res) => {
          this.accessData.set(res);
        },
        error: () => {},
      });
  }

  // Helpers
  getStatusBadgeText(u: any): string {
    if (u.status === 'active') {
      return 'Active';
    }
    if (u.lastAccessed) {
      const yr = u.lastAccessed.slice(0, 4);
      return yr === '2026' ? 'Active' : `Inactive (${yr})`;
    }
    return 'Unused Access';
  }

  getRoleBadgeClass(role: string): string {
    const r = (role || '').toLowerCase();
    if (r.includes('admin')) return 'role-admin';
    if (r.includes('member')) return 'role-member';
    if (r.includes('contributor')) return 'role-contributor';
    return 'role-viewer';
  }

  getUserInitial(name?: string): string {
    if (!name) return 'U';
    const clean = name.trim();
    return clean ? clean.charAt(0).toUpperCase() : 'U';
  }

  getUserAvatarStyle(name?: string, index: number = 0): { bg: string; color: string } {
    const pastels = [
      { bg: '#dbeafe', color: '#1e40af' }, // Blue
      { bg: '#dcfce7', color: '#166534' }, // Emerald
      { bg: '#fef3c7', color: '#92400e' }, // Amber
      { bg: '#ede9fe', color: '#5b21b6' }, // Violet
      { bg: '#ffe4e6', color: '#9f1239' }, // Rose
      { bg: '#ccfbf1', color: '#115e59' }, // Teal
      { bg: '#ffedd5', color: '#9a3412' }, // Orange
      { bg: '#e0e7ff', color: '#3730a3' }, // Indigo
    ];
    if (!name) return pastels[index % pastels.length];
    let hash = 0;
    for (let j = 0; j < name.length; j++) {
      hash = name.charCodeAt(j) + ((hash << 5) - hash);
    }
    return pastels[Math.abs(hash) % pastels.length];
  }

  formatAccessDate(val?: string | null): string {
    if (!val) return 'N/A';
    const clean = String(val).trim().slice(0, 10);
    const parts = clean.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (month >= 1 && month <= 12 && !isNaN(day) && !isNaN(year)) {
        return `${months[month - 1]} ${day}, ${year}`;
      }
    }
    return String(val);
  }
}
