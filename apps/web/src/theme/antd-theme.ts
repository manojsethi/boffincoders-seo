import { theme as antdAlgorithm, type ThemeConfig } from 'antd';
import { palettes, radius, type ThemeMode } from '../styles/tokens';

export function buildAntdTheme(mode: ThemeMode): ThemeConfig {
  const p = palettes[mode];
  return {
    algorithm: mode === 'dark' ? antdAlgorithm.darkAlgorithm : antdAlgorithm.defaultAlgorithm,
    token: {
      colorPrimary: p.accent,
      colorSuccess: p.success,
      colorWarning: p.warning,
      colorError: p.danger,
      colorInfo: p.info,
      colorBgLayout: p.bg,
      colorBgContainer: p.surface,
      colorBgElevated: p.bgElevated,
      colorBorder: p.border,
      colorBorderSecondary: p.border,
      colorText: p.text,
      colorTextSecondary: p.textMuted,
      colorTextTertiary: p.textSubtle,
      colorTextDescription: p.textMuted,
      colorTextPlaceholder: p.textSubtle,
      borderRadius: radius.md,
      borderRadiusLG: radius.lg,
      fontFamily: 'inherit',
      fontSize: 14,
      wireframe: false,
      controlOutline: 'transparent',
      boxShadowSecondary: 'none',
    },
    components: {
      Layout: {
        headerBg: 'transparent',
        bodyBg: 'transparent',
        siderBg: 'transparent',
      },
      Menu: {
        itemBg: 'transparent',
        itemHoverBg: p.surfaceHover,
        itemSelectedBg: p.accentSoft,
        itemSelectedColor: p.accentHover,
        itemColor: p.text,
        itemBorderRadius: radius.md,
      },
      Card: { borderRadiusLG: radius.lg, paddingLG: 16, colorBgContainer: p.surface },
      Table: {
        headerBg: p.surfaceMuted,
        rowHoverBg: p.surfaceHover,
        borderColor: p.border,
        headerColor: p.textMuted,
        cellPaddingBlock: 10,
        cellPaddingInline: 12,
      },
      Tag: { defaultBg: p.surfaceMuted, defaultColor: p.text },
      Button: { borderRadius: radius.md, controlHeight: 32, controlHeightSM: 26 },
      Input: { activeBorderColor: p.accent, hoverBorderColor: p.borderStrong },
      Select: { optionSelectedBg: p.accentSoft },
      Modal: { contentBg: p.surface, headerBg: p.surface },
      Drawer: { colorBgElevated: p.surface },
      Progress: { defaultColor: p.accent, remainingColor: p.surfaceMuted },
      Skeleton: { colorFill: p.surfaceMuted, colorFillContent: p.surfaceHover },
    },
  };
}
