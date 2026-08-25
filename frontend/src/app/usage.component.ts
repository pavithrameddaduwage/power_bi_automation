import { Component, OnInit, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  SyncApiService,
  DashboardAnalyticsResponse,
  AccessUtilizationResponse,
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
      overflow-x: hidden;
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
      font-size: 11.5px;
      font-weight: 600;
      color: #1e3a8a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Custom Searchable Select Trigger */
    .dropdown-trigger {
      height: 34px;
      background: #ffffff;
      border: 1.5px solid #bfdbfe;
      border-radius: 7px;
      padding: 0 24px 0 8px;
      font-size: 12px;
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
      font-weight: 500;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
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

      <!-- ── 1. Top Filter Bar (6 Searchable Dropdowns) ── -->
      <div class="filter-bar-card">
        <div class="filter-bar-header" *ngIf="activeFilterCount() > 0 || loading()">
          <div class="filter-title">
            <span class="filter-badge" *ngIf="activeFilterCount() > 0">{{ activeFilterCount() }} active</span>
          </div>

          <div style="display:flex; align-items:center; gap:10px;">
            <span *ngIf="loading()" style="font-size:12.5px; color:#1e40af; font-weight:600;">
              <span class="spinner"></span> Updating…
            </span>
            <button class="btn-reset" *ngIf="activeFilterCount() > 0" (click)="resetFilters()">
              Clear All Filters
            </button>
          </div>
        </div>

        <div class="filter-grid">
          <!-- 1. Workspace Dropdown -->
          <div class="filter-item">
            <label class="filter-label">Workspace</label>
            <div class="dropdown-trigger" [class.active-filter]="filterGroupId" (click)="toggleDropdown('ws', $event)">
              <span class="trigger-text">{{ getWorkspaceLabel() }}</span>
              <span class="trigger-caret">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </span>
            </div>
            <div class="dropdown-menu-pop" *ngIf="openDropdown() === 'ws'" (click)="$event.stopPropagation()">
              <input class="menu-search-input" [(ngModel)]="searchWs" placeholder="Search workspace…" (click)="$event.stopPropagation()" />
              <div class="menu-options-list">
                <div class="menu-option-item" [class.selected]="!filterGroupId" (click)="selectWorkspace('')">
                  All Workspaces
                </div>
                <div class="menu-option-item" *ngFor="let ws of filteredWorkspaces()" [class.selected]="filterGroupId === ws.groupId" (click)="selectWorkspace(ws.groupId)">
                  {{ ws.groupName }}
                </div>
                <div *ngIf="!filteredWorkspaces().length" style="padding:8px 12px; font-size:12px; color:#1e40af;">No workspaces found</div>
              </div>
            </div>
          </div>

          <!-- 2. Report / Dashboard Dropdown -->
          <div class="filter-item">
            <label class="filter-label">Report / Dashboard</label>
            <div class="dropdown-trigger" [class.active-filter]="filterReportName" (click)="toggleDropdown('rep', $event)">
              <span class="trigger-text">{{ filterReportName || 'All Reports & Dashboards' }}</span>
              <span class="trigger-caret">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </span>
            </div>
            <div class="dropdown-menu-pop" *ngIf="openDropdown() === 'rep'" (click)="$event.stopPropagation()">
              <input class="menu-search-input" [(ngModel)]="searchRep" placeholder="Search report…" (click)="$event.stopPropagation()" />
              <div class="menu-options-list">
                <div class="menu-option-item" [class.selected]="!filterReportName" (click)="selectReport('')">
                  All Reports &amp; Dashboards
                </div>
                <div class="menu-option-item" *ngFor="let r of filteredReports()" [class.selected]="filterReportName === r.reportName" (click)="selectReport(r.reportName)">
                  {{ r.reportName }}
                </div>
                <div *ngIf="!filteredReports().length" style="padding:8px 12px; font-size:12px; color:#1e40af;">No reports found</div>
              </div>
            </div>
          </div>

          <!-- 3. User Dropdown -->
          <div class="filter-item">
            <label class="filter-label">User</label>
            <div class="dropdown-trigger" [class.active-filter]="filterUserEmail" (click)="toggleDropdown('user', $event)">
              <span class="trigger-text">{{ getUserLabel() }}</span>
              <span class="trigger-caret">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </span>
            </div>
            <div class="dropdown-menu-pop" *ngIf="openDropdown() === 'user'" (click)="$event.stopPropagation()">
              <input class="menu-search-input" [(ngModel)]="searchUser" placeholder="Search user…" (click)="$event.stopPropagation()" />
              <div class="menu-options-list">
                <div class="menu-option-item" [class.selected]="!filterUserEmail" (click)="selectUser('')">
                  All Users
                </div>
                <div class="menu-option-item" *ngFor="let u of filteredUsers()" [class.selected]="filterUserEmail === u.email" (click)="selectUser(u.email)">
                  {{ u.name || u.email }}
                </div>
                <div *ngIf="!filteredUsers().length" style="padding:8px 12px; font-size:12px; color:#1e40af;">No users found</div>
              </div>
            </div>
          </div>

          <!-- 4. Year Dropdown -->
          <div class="filter-item">
            <label class="filter-label">Year</label>
            <div class="dropdown-trigger" [class.active-filter]="filterYear" (click)="toggleDropdown('year', $event)">
              <span class="trigger-text">{{ filterYear ? filterYear : 'All Years' }}</span>
              <span class="trigger-caret">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </span>
            </div>
            <div class="dropdown-menu-pop" *ngIf="openDropdown() === 'year'" (click)="$event.stopPropagation()">
              <input class="menu-search-input" [(ngModel)]="searchYear" placeholder="Search year…" (click)="$event.stopPropagation()" />
              <div class="menu-options-list">
                <div class="menu-option-item" [class.selected]="!filterYear" (click)="selectYear('')">
                  All Years
                </div>
                <div class="menu-option-item" *ngFor="let y of filteredYears()" [class.selected]="filterYear === '' + y" (click)="selectYear('' + y)">
                  {{ y }}
                </div>
              </div>
            </div>
          </div>

          <!-- 5. Month Dropdown -->
          <div class="filter-item">
            <label class="filter-label">Month</label>
            <div class="dropdown-trigger" [class.active-filter]="filterMonth" (click)="toggleDropdown('month', $event)">
              <span class="trigger-text">{{ getMonthLabel() }}</span>
              <span class="trigger-caret">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </span>
            </div>
            <div class="dropdown-menu-pop" *ngIf="openDropdown() === 'month'" (click)="$event.stopPropagation()">
              <input class="menu-search-input" [(ngModel)]="searchMonth" placeholder="Search month…" (click)="$event.stopPropagation()" />
              <div class="menu-options-list">
                <div class="menu-option-item" [class.selected]="!filterMonth" (click)="selectMonth('')">
                  All Months
                </div>
                <div class="menu-option-item" *ngFor="let m of filteredMonths()" [class.selected]="filterMonth === m.val" (click)="selectMonth(m.val)">
                  {{ m.name }}
                </div>
              </div>
            </div>
          </div>

          <!-- 6. Date Dropdown -->
          <div class="filter-item">
            <label class="filter-label">Date</label>
            <div class="dropdown-trigger" [class.active-filter]="filterDate" (click)="toggleDropdown('date', $event)">
              <span class="trigger-text">{{ filterDate ? filterDate : 'All Dates' }}</span>
              <span class="trigger-caret">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </span>
            </div>
            <div class="dropdown-menu-pop" *ngIf="openDropdown() === 'date'" (click)="$event.stopPropagation()">
              <input class="menu-search-input" [(ngModel)]="searchDate" placeholder="Search date…" (click)="$event.stopPropagation()" />
              <div class="menu-options-list">
                <div class="menu-option-item" [class.selected]="!filterDate" (click)="selectDate('')">
                  All Dates
                </div>
                <div class="menu-option-item" *ngFor="let d of filteredDates()" [class.selected]="filterDate === d" (click)="selectDate(d)">
                  {{ d }}
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
          <div class="kpi-label">{{ selectedUserEmail() ? 'Pages Visited' : 'Tracked Pages' }}</div>
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

        <!-- Right: Big Blue Pie / Donut Chart (Without percentage) -->
        <div class="card-outlined">
          <div class="card-header-row">
            <h3 class="card-title">{{ selectedUserEmail() ? 'User Page Usage Share' : 'Page Usage Distribution' }}</h3>
            <span style="font-size:13px; font-weight:600; color:#1e3a8a;">
              Top Pages Share
            </span>
          </div>

          <div class="donut-overview-container" *ngIf="pieChartData().length; else noPie">
            <div class="donut-circle-wrap" [style.background]="pieGradient()">
              <div class="donut-hole">
                <div class="donut-hole-val">{{ (analytics()?.kpis?.totalViews || 0) | number }}</div>
                <div class="donut-hole-lbl">Total Views</div>
              </div>
            </div>

            <!-- Clean legend with views in black (percentage removed) -->
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

        <!-- Top Bar: Segmented Tabs [ Pages | People | Access ] + Search & Sub-filters -->
        <div class="breakdown-top-bar">
          <div class="segmented-tabs">
            <button class="segmented-tab" [class.active]="activeBreakdownTab() === 'pages'" (click)="activeBreakdownTab.set('pages'); pageCurrentPage.set(1);">
              Pages
            </button>
            <button class="segmented-tab" [class.active]="activeBreakdownTab() === 'people'" (click)="activeBreakdownTab.set('people'); userCurrentPage.set(1);">
              People
            </button>
            <button class="segmented-tab" [class.active]="activeBreakdownTab() === 'access'" (click)="activeBreakdownTab.set('access'); accessCurrentPage.set(1);">
              Access
            </button>
          </div>

          <!-- Controls for Pages tab -->
          <div style="display:flex; align-items:center; gap:8px;" *ngIf="activeBreakdownTab() === 'pages'">
            <select class="breakdown-search-input" [ngModel]="pageSortOrder()" (ngModelChange)="pageSortOrder.set($event); pageCurrentPage.set(1);" style="width:115px; cursor:pointer;">
              <option value="views-desc">Top Views</option>
              <option value="views-asc">Least Views</option>
              <option value="name-asc">A to Z</option>
            </select>
            <input class="breakdown-search-input" [ngModel]="pageSearchText()" (ngModelChange)="pageSearchText.set($event); pageCurrentPage.set(1);" placeholder="Search..." style="width:160px;" />
          </div>

          <!-- Controls for People tab -->
          <div *ngIf="activeBreakdownTab() === 'people'">
            <input class="breakdown-search-input" [ngModel]="userSearchText()" (ngModelChange)="userSearchText.set($event); userCurrentPage.set(1);" placeholder="Search..." style="width:160px;" />
          </div>

          <!-- Controls for Access tab -->
          <div *ngIf="activeBreakdownTab() === 'access'">
            <input class="breakdown-search-input" [(ngModel)]="accessSearchText" (ngModelChange)="accessCurrentPage.set(1)" placeholder="Search..." style="width:190px;" />
          </div>
        </div>

        <!-- ── TAB 1: PAGES VIEW ── -->
        <ng-container *ngIf="activeBreakdownTab() === 'pages'">
          <div class="breakdown-subtitle">
            {{ filteredPageUsage().length }} pages tracked, ranked by views
          </div>

          <div class="breakdown-list-container" *ngIf="pagedPages().length; else noPages">
            <div class="breakdown-row-item" *ngFor="let p of pagedPages(); let idx = index">
              <div style="display:flex; align-items:center; gap:16px; min-width:0; flex:1;">
                <span class="row-rank-tag">#{{ (pageCurrentPage() - 1) * 5 + idx + 1 }}</span>
                <div style="min-width:0; flex:1;">
                  <div class="row-primary-title" [title]="p.pageName">{{ p.pageName }}</div>
                  <div class="row-secondary-info">{{ p.viewers }} viewer{{ p.viewers === 1 ? '' : 's' }}</div>
                </div>
              </div>

              <div class="row-metric-box">
                <div class="row-metric-val">{{ p.views | number }}</div>
                <div class="row-metric-sub">views</div>
              </div>
            </div>
          </div>
          <ng-template #noPages>
            <div style="color:#94a3b8; font-size:13px; text-align:center; padding:35px 0;">
              No pages match current search.
            </div>
          </ng-template>

          <!-- Pages Pagination -->
          <div class="breakdown-bottom-pagination" *ngIf="filteredPageUsage().length > 5">
            <span class="footer-range-txt">
              {{ (pageCurrentPage() - 1) * 5 + 1 }}–{{ Math.min(pageCurrentPage() * 5, filteredPageUsage().length) }} of {{ filteredPageUsage().length }}
            </span>
            <div class="footer-nav-group">
              <button class="btn-card-nav" [disabled]="pageCurrentPage() === 1" (click)="pageCurrentPage.set(pageCurrentPage() - 1)">
                Prev
              </button>
              <span class="footer-page-indicator">
                Page {{ pageCurrentPage() }} of {{ pageTotalPages() }}
              </span>
              <button class="btn-card-nav" [disabled]="pageCurrentPage() >= pageTotalPages()" (click)="pageCurrentPage.set(pageCurrentPage() + 1)">
                Next
              </button>
            </div>
          </div>
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

          <!-- People Pagination -->
          <div class="breakdown-bottom-pagination" *ngIf="filteredUserUsage().length > 5">
            <span class="footer-range-txt">
              {{ (userCurrentPage() - 1) * 5 + 1 }}–{{ Math.min(userCurrentPage() * 5, filteredUserUsage().length) }} of {{ filteredUserUsage().length }}
            </span>
            <div class="footer-nav-group">
              <button class="btn-card-nav" [disabled]="userCurrentPage() === 1" (click)="userCurrentPage.set(userCurrentPage() - 1)">
                Prev
              </button>
              <span class="footer-page-indicator">
                Page {{ userCurrentPage() }} of {{ userTotalPages() }}
              </span>
              <button class="btn-card-nav" [disabled]="userCurrentPage() >= userTotalPages()" (click)="userCurrentPage.set(userCurrentPage() + 1)">
                Next
              </button>
            </div>
          </div>
        </ng-container>

        <!-- ── TAB 3: ACCESS AUDIT VIEW ── -->
        <ng-container *ngIf="activeBreakdownTab() === 'access'">
          <div class="access-sub-bar">
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

            <span style="font-size:12.5px; color:#64748b; font-weight:500;">
              {{ filteredAccessList().length }} members audited
            </span>
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

          <!-- Access Pagination -->
          <div class="breakdown-bottom-pagination" *ngIf="filteredAccessList().length > 5">
            <span class="footer-range-txt">
              {{ (accessCurrentPage() - 1) * 5 + 1 }}–{{ Math.min(accessCurrentPage() * 5, filteredAccessList().length) }} of {{ filteredAccessList().length }}
            </span>
            <div class="footer-nav-group">
              <button class="btn-card-nav" [disabled]="accessCurrentPage() === 1" (click)="accessCurrentPage.set(accessCurrentPage() - 1)">
                Prev
              </button>
              <span class="footer-page-indicator">
                Page {{ accessCurrentPage() }} of {{ accessTotalPages() }}
              </span>
              <button class="btn-card-nav" [disabled]="accessCurrentPage() >= accessTotalPages()" (click)="accessCurrentPage.set(accessCurrentPage() + 1)">
                Next
              </button>
            </div>
          </div>
        </ng-container>

      </div>

      <!-- ── 4B. USER DETAIL FULL-WIDTH PAGE BREAKDOWN (with Pagination) ── -->
      <div class="card-outlined" *ngIf="selectedUserEmail()">
        <div class="card-header-row">
          <div>
            <h3 class="card-title">Pages &amp; Tabs Viewed by {{ currentUserObject()?.name || selectedUserEmail() }}</h3>
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
              <span class="page-name" [title]="p.pageName">{{ p.pageName }}</span>
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
  searchWs: string = '';
  searchRep: string = '';
  searchUser: string = '';
  searchYear: string = '';
  searchMonth: string = '';
  searchDate: string = '';

  // Breakdown active tab ('pages' | 'people' | 'access')
  activeBreakdownTab = signal<'pages' | 'people' | 'access'>('pages');

  // In-page search & sorting as reactive signals
  pageSearchText = signal<string>('');
  pageSortOrder = signal<'views-desc' | 'views-asc' | 'name-asc'>('views-desc');
  userSearchText = signal<string>('');
  accessFilterTab = signal<'all' | 'unused' | 'active'>('all');
  accessSearchText: string = '';

  // Pagination states (5 items per page)
  pageCurrentPage = signal<number>(1);
  userCurrentPage = signal<number>(1);
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
    const s = (this.searchWs || '').toLowerCase().trim();
    return s ? raw.filter(w => w.groupName.toLowerCase().includes(s)) : raw;
  });

  filteredReports = computed(() => {
    const raw = this.availableReports();
    const s = (this.searchRep || '').toLowerCase().trim();
    return s ? raw.filter(r => r.reportName.toLowerCase().includes(s)) : raw;
  });

  filteredUsers = computed(() => {
    const raw = this.availableUsers();
    const s = (this.searchUser || '').toLowerCase().trim();
    return s ? raw.filter(u => (u.name || '').toLowerCase().includes(s) || u.email.toLowerCase().includes(s)) : raw;
  });

  filteredYears = computed(() => {
    const raw = this.availableYears();
    const s = (this.searchYear || '').trim();
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
    const s = (this.searchMonth || '').toLowerCase().trim();
    return s ? this.allMonthsList.filter(m => m.name.toLowerCase().includes(s)) : this.allMonthsList;
  });

  filteredDates = computed(() => {
    const raw = this.availableDates();
    const s = (this.searchDate || '').trim();
    return s ? raw.filter(d => d.includes(s)) : raw;
  });

  // Dropdown Label Helpers
  getWorkspaceLabel(): string {
    if (!this.filterGroupId) return 'All Workspaces';
    return this.availableWorkspaces().find(w => w.groupId === this.filterGroupId)?.groupName || 'Selected Workspace';
  }

  getUserLabel(): string {
    if (!this.filterUserEmail) return 'All Users';
    const match = this.availableUsers().find(u => u.email.toLowerCase() === this.filterUserEmail.toLowerCase());
    return match ? (match.name || match.email) : this.filterUserEmail;
  }

  getMonthLabel(): string {
    if (!this.filterMonth) return 'All Months';
    return this.allMonthsList.find(m => m.val === this.filterMonth)?.name || 'Selected Month';
  }

  // Selection handlers
  selectWorkspace(id: string) {
    this.filterGroupId = id;
    this.searchWs = '';
    // If a report is selected that doesn't belong to the newly picked workspace, clear it
    if (id && this.filterReportName) {
      const rep = this.availableReports().find((r) => r.reportName === this.filterReportName);
      if (rep && rep.groupId && rep.groupId !== id) {
        this.filterReportName = '';
      }
    }
    this.pageSearchText.set('');
    this.userSearchText.set('');
    this.accessSearchText = '';
    this.pageCurrentPage.set(1);
    this.userCurrentPage.set(1);
    this.accessCurrentPage.set(1);
    this.openDropdown.set(null);
    this.onFilterChanged();
  }

  selectReport(name: string) {
    this.filterReportName = name;
    this.searchRep = '';
    // If the selected report has a known workspace, sync workspace if not set
    if (name) {
      const rep = this.availableReports().find((r) => r.reportName.trim().toLowerCase() === name.trim().toLowerCase());
      if (rep && rep.groupId && !this.filterGroupId) {
        // keep filterGroupId aligned
      }
    }
    this.pageSearchText.set('');
    this.userSearchText.set('');
    this.accessSearchText = '';
    this.pageCurrentPage.set(1);
    this.userCurrentPage.set(1);
    this.accessCurrentPage.set(1);
    this.openDropdown.set(null);
    this.onFilterChanged();
  }

  selectUser(email: string) {
    this.filterUserEmail = email;
    this.selectedUserEmail.set(email);
    this.searchUser = '';
    this.pageCurrentPage.set(1);
    this.userCurrentPage.set(1);
    this.accessCurrentPage.set(1);
    this.openDropdown.set(null);
    this.onFilterChanged();
  }

  selectYear(yr: string) {
    this.filterYear = yr;
    this.openDropdown.set(null);
    this.onFilterChanged();
  }

  selectMonth(m: string) {
    this.filterMonth = m;
    this.openDropdown.set(null);
    this.onFilterChanged();
  }

  selectDate(d: string) {
    this.filterDate = d;
    this.openDropdown.set(null);
    this.onFilterChanged();
  }

  navigateToUser(email: string) {
    this.selectedUserEmail.set(email);
    this.filterUserEmail = email;
    this.pageCurrentPage.set(1);
    this.onFilterChanged();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  clearSelectedUser() {
    this.selectedUserEmail.set('');
    this.filterUserEmail = '';
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

  // Big Pie / Donut Chart Data in Blue Shades
  pieChartData = computed(() => {
    const pages = this.analytics()?.pageUsage || [];
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
  pageTotalPages = computed(() => Math.max(1, Math.ceil(this.filteredPageUsage().length / 5)));
  pagedPages = computed(() => {
    const p = this.pageCurrentPage();
    return this.filteredPageUsage().slice((p - 1) * 5, p * 5);
  });

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
  userTotalPages = computed(() => Math.max(1, Math.ceil(this.filteredUserUsage().length / 5)));
  pagedUsers = computed(() => {
    const p = this.userCurrentPage();
    return this.filteredUserUsage().slice((p - 1) * 5, p * 5);
  });

  // Filtered Access List
  filteredAccessList = computed(() => {
    const raw = (this.accessData()?.users || []).filter(u => !this.isServicePrincipal(u.displayName, u.email));
    const tab = this.accessFilterTab();
    const search = (this.accessSearchText || '').toLowerCase().trim();

    const filtered = raw.filter(u => {
      if (tab === 'unused' && u.status !== 'unused') return false;
      if (tab === 'active' && u.status !== 'active') return false;
      if (search) {
        return u.displayName.toLowerCase().includes(search) || u.email.toLowerCase().includes(search) || u.role.toLowerCase().includes(search);
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
  accessTotalPages = computed(() => Math.max(1, Math.ceil(this.filteredAccessList().length / 5)));
  pagedAccessList = computed(() => {
    const p = this.accessCurrentPage();
    return this.filteredAccessList().slice((p - 1) * 5, p * 5);
  });

  constructor(private api: SyncApiService, private toast: ToastService) {}

  ngOnInit(): void {
    this.loadAnalytics();
    this.loadAccessUtilization();
  }

  onFilterChanged(): void {
    this.loadAnalytics();
    this.loadAccessUtilization();
  }

  resetFilters(): void {
    this.filterGroupId = '';
    this.filterReportName = '';
    this.filterUserEmail = '';
    this.selectedUserEmail.set('');
    this.filterYear = '';
    this.filterMonth = '';
    this.filterDate = '';
    this.searchWs = '';
    this.searchRep = '';
    this.searchUser = '';
    this.searchYear = '';
    this.searchMonth = '';
    this.searchDate = '';
    this.pageSearchText.set('');
    this.pageSortOrder.set('views-desc');
    this.userSearchText.set('');
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

  private loadAccessUtilization(): void {
    this.api.getAccessUtilization(
      this.filterGroupId || undefined,
      this.filterReportName || undefined,
    ).subscribe({
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
