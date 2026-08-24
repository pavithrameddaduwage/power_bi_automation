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
      gap: 10px;
      width: 100%;
      box-sizing: border-box;
    }

    @media (max-width: 1200px) {
      .filter-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    @media (max-width: 640px) {
      .filter-grid {
        grid-template-columns: 1fr;
      }
    }

    .filter-item {
      display: flex;
      flex-direction: column;
      gap: 5px;
      position: relative;
      min-width: 0;
    }

    .filter-label {
      font-size: 13px;
      font-weight: 600;
      color: #1e3a8a;
    }

    /* Custom Searchable Select Trigger */
    .dropdown-trigger {
      height: 38px;
      background: #ffffff;
      border: 1.5px solid #bfdbfe;
      border-radius: 8px;
      padding: 0 28px 0 12px;
      font-size: 13.5px;
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
      min-width: 250px;
      width: max-content;
      max-width: 360px;
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
      height: 36px;
      border: 1.5px solid #bfdbfe;
      border-radius: 6px;
      padding: 0 10px;
      font-size: 13px;
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
      padding: 9px 12px;
      font-size: 13px;
      line-height: 1.4;
      min-height: 36px;
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
      gap: 14px;
      width: 100%;
      box-sizing: border-box;
    }

    .kpi-grid.four-cols {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    @media (max-width: 1100px) {
      .kpi-grid, .kpi-grid.four-cols {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 640px) {
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
      gap: 14px;
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
      gap: 6px;
      flex: 1;
      min-width: 40px;
      height: 100%;
      justify-content: flex-end;
    }

    .monthly-bar-val {
      font-size: 11.5px;
      font-weight: 700;
      color: #0f172a;
      font-variant-numeric: tabular-nums;
    }

    /* Clean Solid Yellow Bars */
    .monthly-bar-pill {
      width: 100%;
      max-width: 46px;
      background: #f59e0b;
      border-radius: 6px 6px 0 0;
      min-height: 8px;
      transition: all 0.2s ease;
      cursor: pointer;
    }

    .monthly-bar-pill:hover {
      background: #d97706;
      transform: scaleY(1.03);
    }

    .monthly-bar-lbl {
      font-size: 11.5px;
      font-weight: 600;
      color: #0f172a;
      text-align: center;
      margin-top: 4px;
      white-space: nowrap;
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

    /* ── Details Grid (Page Breakdown vs User Activity) ── */
    .dashboard-two-col {
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 16px;
      width: 100%;
      box-sizing: border-box;
    }

    @media (max-width: 1024px) {
      .dashboard-two-col {
        grid-template-columns: 1fr;
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
      gap: 6px;
      background: #eff6ff;
      padding: 4px;
      border-radius: 8px;
      border: 1px solid #bfdbfe;
    }

    .access-tab-btn {
      background: transparent;
      border: none;
      padding: 6px 14px;
      font-size: 13px;
      font-weight: 600;
      color: #1e3a8a;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .access-tab-btn.active {
      background: #ffffff;
      color: #1d4ed8;
      box-shadow: 0 1px 3px rgba(37, 99, 235, 0.08);
      font-weight: 700;
    }

    .access-table-wrap {
      border: 1.5px solid #dbeafe;
      border-radius: 10px;
      overflow-x: auto;
      width: 100%;
      box-sizing: border-box;
    }

    .clean-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      text-align: left;
    }

    .clean-table th {
      background: #eff6ff;
      color: #1e3a8a;
      font-weight: 700;
      padding: 11px 14px;
      font-size: 12.5px;
      border-bottom: 1.5px solid #bfdbfe;
      position: sticky;
      top: 0;
      z-index: 2;
    }

    .clean-table td {
      padding: 11px 14px;
      border-bottom: 1px solid #eff6ff;
      color: #0f172a;
      vertical-align: middle;
    }

    .clean-table tbody tr:hover td {
      background: #eff6ff;
    }

    .role-badge {
      display: inline-block;
      padding: 3px 9px;
      border-radius: 99px;
      font-size: 11.5px;
      font-weight: 700;
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
                <div class="monthly-bar-lbl">{{ m.label }}</div>
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

      <!-- ── 4A. MAIN DASHBOARD DETAILED BREAKDOWN (when NO user is selected) ── -->
      <div class="dashboard-two-col" *ngIf="!selectedUserEmail()">

        <!-- Column 1: Page-wise Usage Breakdown (Clean Rows with Pagination) ── -->
        <div class="card-outlined">
          <div class="card-header-row">
            <h3 class="card-title">Page &amp; Tab Usage Breakdown</h3>

            <div style="display:flex; align-items:center; gap:8px;">
              <input class="search-mini-input" [ngModel]="pageSearchText()" (ngModelChange)="pageSearchText.set($event); pageCurrentPage.set(1);" placeholder="Search pages…" style="width:140px;" />
              <select class="search-mini-input" [ngModel]="pageSortOrder()" (ngModelChange)="pageSortOrder.set($event); pageCurrentPage.set(1);" style="width:115px; cursor:pointer;">
                <option value="views-desc">Top Views</option>
                <option value="views-asc">Least Views</option>
                <option value="name-asc">A to Z</option>
              </select>
            </div>
          </div>

          <div class="page-diagram-list" *ngIf="pagedPages().length; else noPages">
            <div class="page-clean-row" *ngFor="let p of pagedPages(); let idx = index">
              <div class="page-title-group">
                <span class="page-rank-pill" *ngIf="pageSortOrder() === 'views-desc'">#{{ (pageCurrentPage() - 1) * 5 + idx + 1 }}</span>
                <span class="page-name" [title]="p.pageName">{{ p.pageName }}</span>
              </div>
              <div class="page-stats-right">
                <span class="page-viewers-lbl">{{ p.viewers }} viewer{{ p.viewers === 1 ? '' : 's' }}</span>
                <span class="page-views-num">{{ p.views | number }} views</span>
              </div>
            </div>

            <!-- Page Pagination Controls -->
            <div class="pagination-bar" *ngIf="filteredPageUsage().length > 5">
              <span class="pagination-info">
                {{ (pageCurrentPage() - 1) * 5 + 1 }}–{{ Math.min(pageCurrentPage() * 5, filteredPageUsage().length) }} of {{ filteredPageUsage().length }} pages
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
          <ng-template #noPages>
            <div style="color:#1e40af; font-size:13px; text-align:center; padding:35px 0;">
              No pages match current filters.
            </div>
          </ng-template>
        </div>

        <!-- Column 2: User Activity Breakdown (Clean Rows with Pagination) ── -->
        <div class="card-outlined">
          <div class="card-header-row">
            <h3 class="card-title">User Activity Breakdown</h3>

            <input class="search-mini-input" [ngModel]="userSearchText()" (ngModelChange)="userSearchText.set($event); userCurrentPage.set(1);" placeholder="Search users…" style="width:140px;" />
          </div>

          <div class="user-list" *ngIf="pagedUsers().length; else noUsers">
            <div class="user-card-item" *ngFor="let u of pagedUsers(); let i = index" (click)="navigateToUser(u.email)" title="Click to view detailed analytics for this user">
              <div class="user-meta-group">
                <div class="user-avatar"
                     [style.background]="getUserAvatarStyle(u.name, i).bg"
                     [style.color]="getUserAvatarStyle(u.name, i).color">
                  {{ getUserInitial(u.name) }}
                </div>
                <div class="user-text-info">
                  <div class="user-fullname" [title]="u.name">{{ u.name }}</div>
                  <div class="user-email-txt" [title]="u.email">{{ u.email }}</div>
                </div>
              </div>

              <div class="user-activity-right">
                <div>
                  <div class="user-views-txt">{{ u.views | number }} views</div>
                  <div class="user-date-txt">{{ u.pagesCount }} page{{ u.pagesCount === 1 ? '' : 's' }} • {{ formatAccessDate(u.lastAccessed) }}</div>
                </div>
              </div>
            </div>

            <!-- User Pagination Controls -->
            <div class="pagination-bar" *ngIf="filteredUserUsage().length > 5">
              <span class="pagination-info">
                {{ (userCurrentPage() - 1) * 5 + 1 }}–{{ Math.min(userCurrentPage() * 5, filteredUserUsage().length) }} of {{ filteredUserUsage().length }} users
              </span>
              <div class="pagination-controls">
                <button class="btn-page" [disabled]="userCurrentPage() === 1" (click)="userCurrentPage.set(userCurrentPage() - 1)">
                  Previous
                </button>
                <span class="page-current-pill">
                  Page {{ userCurrentPage() }} of {{ userTotalPages() }}
                </span>
                <button class="btn-page" [disabled]="userCurrentPage() >= userTotalPages()" (click)="userCurrentPage.set(userCurrentPage() + 1)">
                  Next
                </button>
              </div>
            </div>
          </div>
          <ng-template #noUsers>
            <div style="color:#1e40af; font-size:13px; text-align:center; padding:35px 0;">
              No users match current filters.
            </div>
          </ng-template>
        </div>
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

      <!-- ── 5. Access Level & Unused Access Audit (with Pagination) ── -->
      <div class="access-section-card" *ngIf="!selectedUserEmail()">
        <div class="access-header-group">
          <h3 class="card-title">Workspace &amp; Dashboard Access Audit</h3>

          <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
            <div class="access-tabs">
              <button class="access-tab-btn" [class.active]="accessFilterTab() === 'all'" (click)="accessFilterTab.set('all'); accessCurrentPage.set(1);">
                All Access ({{ accessData()?.totalUsers || 0 }})
              </button>
              <button class="access-tab-btn" [class.active]="accessFilterTab() === 'unused'" (click)="accessFilterTab.set('unused'); accessCurrentPage.set(1);" style="color:#b45309;">
                Unused Access ({{ accessData()?.unusedUsers || 0 }})
              </button>
              <button class="access-tab-btn" [class.active]="accessFilterTab() === 'active'" (click)="accessFilterTab.set('active'); accessCurrentPage.set(1);">
                Active ({{ accessData()?.activeUsers || 0 }})
              </button>
            </div>

            <input class="search-mini-input" [(ngModel)]="accessSearchText" (ngModelChange)="accessCurrentPage.set(1)" placeholder="Search access list…" />
          </div>
        </div>

        <!-- Access Table -->
        <div class="access-table-wrap">
          <table class="clean-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role / Permission</th>
                <th style="text-align:right;">Views</th>
                <th style="text-align:right;">Last Active</th>
                <th style="text-align:center;">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let u of pagedAccessList(); let i = index">
                <td style="font-weight:500;">
                  <div style="display:flex; align-items:center; gap:9px;">
                    <div class="user-avatar" style="width:28px; height:28px; font-size:11.5px;"
                         [style.background]="getUserAvatarStyle(u.displayName, i).bg"
                         [style.color]="getUserAvatarStyle(u.displayName, i).color">
                      {{ getUserInitial(u.displayName) }}
                    </div>
                    <span>{{ u.displayName }}</span>
                  </div>
                </td>
                <td style="color:#1e3a8a;">{{ u.email }}</td>
                <td>
                  <span class="role-badge" [ngClass]="getRoleBadgeClass(u.role)">
                    {{ u.role }}
                  </span>
                </td>
                <td style="text-align:right; font-weight:700; color:#0f172a;">
                  {{ u.views | number }}
                </td>
                <td style="text-align:right; font-size:12.5px;">
                  <span *ngIf="u.status === 'active'" style="color:#0f172a; font-weight:600;">
                    {{ formatAccessDate(u.lastAccessed) }}
                  </span>
                  <span *ngIf="u.status !== 'active'" style="color:#dc2626; font-weight:700;">
                    {{ u.lastAccessed ? formatAccessDate(u.lastAccessed) : 'Never' }}
                  </span>
                </td>
                <td style="text-align:center;">
                  <button *ngIf="u.views > 0" (click)="navigateToUser(u.email)"
                          style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; border-radius:5px; font-size:12px; padding:3px 10px; cursor:pointer; font-weight:600;">
                    View Analytics
                  </button>
                  <span *ngIf="u.views === 0" style="color:#1e40af; font-size:12px;">—</span>
                </td>
              </tr>
              <tr *ngIf="filteredAccessList().length === 0">
                <td colspan="6" style="text-align:center; padding:30px; color:#1e40af;">
                  No users found matching current access filter.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Access Table Pagination Controls -->
        <div class="pagination-bar" *ngIf="filteredAccessList().length > 5">
          <span class="pagination-info">
            {{ (accessCurrentPage() - 1) * 5 + 1 }}–{{ Math.min(accessCurrentPage() * 5, filteredAccessList().length) }} of {{ filteredAccessList().length }} members
          </span>
          <div class="pagination-controls">
            <button class="btn-page" [disabled]="accessCurrentPage() === 1" (click)="accessCurrentPage.set(accessCurrentPage() - 1)">
              Previous
            </button>
            <span class="page-current-pill">
              Page {{ accessCurrentPage() }} of {{ accessTotalPages() }}
            </span>
            <button class="btn-page" [disabled]="accessCurrentPage() >= accessTotalPages()" (click)="accessCurrentPage.set(accessCurrentPage() + 1)">
              Next
            </button>
          </div>
        </div>
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
    this.openDropdown.set(null);
    this.onFilterChanged();
  }

  selectReport(name: string) {
    this.filterReportName = name;
    this.openDropdown.set(null);
    this.onFilterChanged();
  }

  selectUser(email: string) {
    this.filterUserEmail = email;
    this.selectedUserEmail.set(email);
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

    const monthMap = new Map<string, { label: string; yearMonth: string; views: number }>();
    const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (const item of raw) {
      if (!item.date) continue;
      const parts = item.date.split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const monthIdx = parseInt(parts[1], 10) - 1;
        const key = `${year}-${parts[1]}`;
        const label = `${shortMonths[monthIdx] || parts[1]} ${year}`;
        const existing = monthMap.get(key);
        if (existing) {
          existing.views += item.views;
        } else {
          monthMap.set(key, { label, yearMonth: key, views: item.views });
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
