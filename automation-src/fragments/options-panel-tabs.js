const initOptionsPanelFilter = () => {
  const panel = document.querySelector('.taInnerPanelElement');
  const input = document.querySelector('#taOptFilterInput');
  const onlyChanged = document.querySelector('#taOptFilterOnlyChanged');
  const countEl = document.querySelector('#taOptFilterCount');
  if (!panel || !input || !onlyChanged || !countEl) {
    return;
  }

  const isOptionChanged = el => {
    if (el.tagName === 'SELECT') {
      return !!el.querySelector('option[value="0"]') && el.value !== '0';
    }
    if (el.type === 'checkbox') {
      return el.checked;
    }
    if (el.type === 'number') {
      return el.value !== '' && el.value !== '0';
    }
    return false;
  };

  const applyFilter = () => {
    const query = input.value.trim().toLowerCase();
    const onlyChangedActive = onlyChanged.checked;
    let shown = 0;
    let total = 0;
    panel.querySelectorAll('.taOptRow').forEach(row => {
      total += 1;
      const changed = [...row.querySelectorAll('.option')].some(isOptionChanged);
      row.classList.toggle('taOptChanged', changed);
      const matchesQuery = !query || row.textContent.toLowerCase().includes(query);
      const matchesChanged = !onlyChangedActive || changed;
      const visible = matchesQuery && matchesChanged;
      row.classList.toggle('taOptRowHidden', !visible);
      if (visible) {
        shown += 1;
      }
    });
    if (query || onlyChangedActive) {
      panel.querySelectorAll('.taOptRow:not(.taOptRowHidden)').forEach(row => {
        let ancestor = row.parentElement ? row.parentElement.closest('details') : null;
        while (ancestor) {
          ancestor.open = true;
          ancestor = ancestor.parentElement ? ancestor.parentElement.closest('details') : null;
        }
      });
    }
    countEl.textContent = total ? `${shown} / ${total}` : '';
  };

  const expandAdvancedIfManualOverrides = () => {
    const manualOverridesInput = document.querySelector('input[data-setting="smartBuild"][data-key="manualOverrides"]');
    if (manualOverridesInput && manualOverridesInput.checked) {
      panel.querySelectorAll('.taOptAdvanced').forEach(details => {
        details.open = true;
      });
    }
  };

  input.addEventListener('input', applyFilter);
  onlyChanged.addEventListener('change', applyFilter);
  const panelRoot = panel.parentElement;
  if (panelRoot && window.MutationObserver) {
    new MutationObserver(() => {
      if (panelRoot.classList.contains('taPanelElementVisible')) {
        applyFilter();
        expandAdvancedIfManualOverrides();
      }
    }).observe(panelRoot, {
      attributes: true,
      attributeFilter: ['class']
    });
  }
  panel.addEventListener('input', event => {
    if (event.target.classList && event.target.classList.contains('option')) {
      applyFilter();
    }
  });
  panel.addEventListener('change', event => {
    if (event.target.classList && event.target.classList.contains('option')) {
      applyFilter();
      if (event.target.dataset.setting === 'smartBuild' && event.target.dataset.key === 'manualOverrides') {
        expandAdvancedIfManualOverrides();
      }
    }
  });
  panel.addEventListener('click', event => {
    if (event.target.matches('.setAllMax, .setAllPrio, .minus1Medium, .zeroDisabled, .spellsResourceEnable, .spellsResourceDisable, .spellsArmyEnable, .spellsArmyDisable, .toggleLevelFights')) {
      applyFilter();
    }
  });

  applyFilter();
  expandAdvancedIfManualOverrides();
};
