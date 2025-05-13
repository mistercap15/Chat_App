import '../global.css'
import { useTheme } from '@/context/ThemeContext';

export const useThemeStyle = () => {
  const { isDarkMode } = useTheme();
  const styles = {
    textColor: isDarkMode ? 'text-white' : 'text-amber-900',
    bgColor: isDarkMode ? 'bg-gray-900' : 'bg-amber-50',
    sectionBg: isDarkMode ? 'bg-gray-800' : 'bg-white',
  };
  return styles;
};