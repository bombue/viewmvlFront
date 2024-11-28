import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ViewMVL.css';

function ViewMVL() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mvlID, setMvlID] = useState('');
  const [contours, setContours] = useState(['TEST']);
  const [mainUnit, setMainUnit] = useState('');
  const [mainSystem, setMainSystem] = useState('');
  const [unitOptions, setUnitOptions] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [showInstalledOnly, setShowInstalledOnly] = useState(true);
  const [showLegend, setShowLegend] = useState(false);

  const contourOrder = ['TEST', 'PROD', 'CERT']; // Define the contour order

  const handleSearch = () => {
    setLoading(true);
    setErrorMessage('');

    axios
      .get('http://localhost:9080/api/mvlid/getInfo', {
        // .get('http://193.48.8.248:9080/api/mvlid/getInfo', {
        params: {
          mvlID: mvlID,
          contour: contours.join(','),
        },
      })
      .then((response) => {
        if (response.data && Object.keys(response.data).length > 0) {
          setData(response.data);
          updateUnitOptions(response.data);

          // Set main system based on where the main unit is found
          const systemContainingMainUnit = Object.keys(response.data).find((system) =>
            response.data[system].some(
              (item) => `${item.unit.trim()}/${item.contour.trim()}` === mainUnit.trim()
            )
          );
          setMainSystem(systemContainingMainUnit);
        } else {
          setErrorMessage('No data found');
          setData(null);
          setUnitOptions([]);
          setMainUnit('');
          setMainSystem('');
        }
        setLoading(false);
      })
      .catch((error) => {
        setLoading(false);
        if (error.response) {
          const { code, message } = error.response.data;
          setErrorMessage(`Error ${code}: ${message}`);
        } else if (error.request) {
          setErrorMessage('No response from the server.');
        } else {
          setErrorMessage('Error fetching data.');
        }
        setUnitOptions([]);
        setMainUnit('');
        setMainSystem('');
        setData(null); // Clear previous data if error occurs
      });
  };

  const updateUnitOptions = (data) => {
    const unitStatusMap = new Map();
    for (const system of Object.keys(data)) {
      for (const item of data[system]) {
        const unit = item.unit.trim();
        const contour = item.contour.trim();
        const unitKey = `${unit}/${contour}`;
        const status = item.status.trim() === 'Y' ? 'Installed' : 'Not Installed';
        if (!unitStatusMap.has(unitKey)) {
          unitStatusMap.set(unitKey, { unitKey, unit, contour, status });
        }
      }
    }

    let unitsWithStatus = Array.from(unitStatusMap.values());

    // Sort unitsWithStatus according to contour order and unit name
    unitsWithStatus.sort((a, b) => {
      const contourPriorityA = contourOrder.indexOf(a.contour);
      const contourPriorityB = contourOrder.indexOf(b.contour);

      if (contourPriorityA !== contourPriorityB) {
        return contourPriorityA - contourPriorityB;
      }

      return a.unit.localeCompare(b.unit);
    });

    setUnitOptions(unitsWithStatus);

    // Find if any 'STU/*' unit exists by checking unitKey
    const stuUnits = unitsWithStatus.filter((unit) => unit.unitKey.startsWith('STU/'));

    if (stuUnits.length > 0) {
      // Sort 'STU/*' units based on contourOrder and select the first one
      stuUnits.sort((a, b) => {
        const contourPriorityA = contourOrder.indexOf(a.contour);
        const contourPriorityB = contourOrder.indexOf(b.contour);
        return contourPriorityA - contourPriorityB;
      });
      setMainUnit(stuUnits[0].unitKey);
    } else if (unitsWithStatus.length > 0) {
      // Set mainUnit to the first unit in the sorted list
      setMainUnit(unitsWithStatus[0].unitKey);
    } else {
      setMainUnit('');
    }
  };

  // Use useEffect to update mainUnit when filteredUnitOptions change
  const filteredUnitOptions = unitOptions.filter(({ status }) => {
    if (!showInstalledOnly) return true;
    return status === 'Installed';
  });

  useEffect(() => {
    if (filteredUnitOptions.length > 0) {
      const mainUnitExists = filteredUnitOptions.some((option) => option.unitKey === mainUnit);
      if (!mainUnitExists) {
        setMainUnit(filteredUnitOptions[0].unitKey);
      }
    } else {
      // No units available, set mainUnit to ''
      setMainUnit('');
    }
  }, [filteredUnitOptions, mainUnit]);

  // Update mainSystem when mainUnit changes
  useEffect(() => {
    if (data && mainUnit) {
      const [mainUnitName, mainUnitContour] = mainUnit.split('/');
      const systemContainingMainUnit = Object.keys(data).find((system) =>
        data[system].some(
          (item) =>
            item.unit.trim() === mainUnitName.trim() &&
            item.contour.trim() === mainUnitContour.trim()
        )
      );
      setMainSystem(systemContainingMainUnit || '');
    }
  }, [mainUnit, data]);

  const highlightDifferences = (mainItem, item, allItems) => {
    const differences = {};
    if (mainItem.exists !== item.exists) differences.exists = true;
    if (mainItem.sourceChangeDate !== item.sourceChangeDate) differences.sourceChangeDate = true;
    if (mainItem.sourceChangeTime !== item.sourceChangeTime) differences.sourceChangeTime = true;

    const mainModules = mainItem.modules.map((module) => module.name);
    item.modules.forEach((module) => {
      if (!mainModules.includes(module.name)) {
        differences[`moduleMissing_${module.name}`] = true;
      } else {
        const mainModule = mainItem.modules.find((m) => m.name === module.name);
        if (mainModule.sourceChangeDate !== module.sourceChangeDate)
          differences[`moduleSourceChangeDate_${module.name}`] = true;
        if (mainModule.sourceChangeTime !== module.sourceChangeTime)
          differences[`moduleSourceChangeTime_${module.name}`] = true;
      }
    });

    mainItem.modules.forEach((module) => {
      const isUnique = allItems.every((otherItem) => {
        if (
          otherItem.object.name !== mainItem.object.name ||
          otherItem.object.type !== mainItem.object.type ||
          (otherItem.unit === mainItem.unit && otherItem.system === mainItem.system)
        ) {
          return true;
        }
        return !otherItem.modules.some((m) => m.name === module.name);
      });
      if (isUnique) {
        differences[`moduleUnique_${module.name}`] = true;
      }
    });

    return differences;
  };

  const renderModules = (modules, differences) => {
    // Filter out modules that have all fields empty or spaces
    const filteredModules = modules.filter((module) => {
      return Object.values(module).some((value) => value.trim() !== '');
    });

    return filteredModules.map((module, index) => (
      <tr key={index}>
        <td colSpan="9"></td>
        <td
          className={
            differences[`moduleMissing_${module.name}`]
              ? 'highlight-red'
              : differences[`moduleUnique_${module.name}`]
              ? 'highlight-orange'
              : ''
          }
        >
          {module.name.trim()}
        </td>
        <td>{module.library.trim()}</td>
        <td className={differences[`moduleChangeDate_${module.name}`] ? 'highlight' : ''}>
          {module.changeDate}
        </td>
        <td className={differences[`moduleChangeTime_${module.name}`] ? 'highlight' : ''}>
          {module.changeTime}
        </td>
        <td className={differences[`moduleSourceChangeDate_${module.name}`] ? 'highlight' : ''}>
          {module.sourceChangeDate}
        </td>
        <td className={differences[`moduleSourceChangeTime_${module.name}`] ? 'highlight' : ''}>
          {module.sourceChangeTime}
        </td>
      </tr>
    ));
  };

  const renderUnitTable = (unitKey, items, mainUnitItems, allItems, status) => {
    return (
      <div key={unitKey}>
        <h3>
          Unit: {unitKey} ({status})
        </h3>
        <table>
          <thead>
            <tr>
              <th>Unit</th>
              <th>Object Name</th>
              <th>Object Type</th>
              <th>Object Library</th>
              <th>Exists</th>
              <th>Change Date</th>
              <th>Change Time</th>
              <th>Source Change Date</th>
              <th>Source Change Time</th>
              <th>Module Name</th>
              <th>Module Library</th>
              <th>Module Change Date</th>
              <th>Module Change Time</th>
              <th>Module Source Change Date</th>
              <th>Module Source Change Time</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const mainItem = mainUnitItems.find(
                (mainItem) =>
                  mainItem.object.name === item.object.name &&
                  mainItem.object.type === item.object.type
              );
              const differences = mainItem ? highlightDifferences(mainItem, item, allItems) : {};
              return (
                <React.Fragment key={index}>
                  <tr>
                    <td>{`${item.unit.trim()}/${item.contour.trim()}`}</td>
                    <td>{item.object.name.trim()}</td>
                    <td>{item.object.type.trim()}</td>
                    <td>{item.object.library.trim()}</td>
                    <td className={differences.exists ? 'highlight' : ''}>{item.exists}</td>
                    <td className={differences.changeDate ? 'highlight' : ''}>
                      {item.changeDate}
                    </td>
                    <td className={differences.changeTime ? 'highlight' : ''}>
                      {item.changeTime}
                    </td>
                    <td className={differences.sourceChangeDate ? 'highlight' : ''}>
                      {item.sourceChangeDate}
                    </td>
                    <td className={differences.sourceChangeTime ? 'highlight' : ''}>
                      {item.sourceChangeTime}
                    </td>
                    <td colSpan="6"></td>
                  </tr>
                  {renderModules(item.modules, differences)}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderSystem = (system, units) => {
    return (
      <div key={system}>
        <h2>System: {system.trim()}</h2>
        {units}
      </div>
    );
  };

  const renderTable = (data) => {
    const mainUnitItems = getMainUnitItems(data);
    const allItems = getAllItemsWithSystem(data);

    // Filter and sort systems
    let systems = Object.keys(data);
    systems = systems.sort((a, b) => {
      if (a === mainSystem) return -1;
      if (b === mainSystem) return 1;
      return a.localeCompare(b);
    });

    return systems.map((system) => {
      const items = data[system];
      const units = groupByUnit(system, items, mainUnitItems, allItems);
	  if (units.length === 0) return null; // Skip systems with no units after filtering																					  
      return renderSystem(system, units);
    });
  };

  const getMainUnitItems = (data) => {
    const items = [];
    const [mainUnitName, mainUnitContour] = mainUnit.split('/');
    for (const system of Object.keys(data)) {
      for (const item of data[system]) {
        if (
          item.unit.trim() === mainUnitName.trim() &&
          item.contour.trim() === mainUnitContour.trim()
        ) {
          items.push({ ...item, system });
        }
      }
    }
    return items;
  };

  const getAllItemsWithSystem = (data) => {
    const items = [];
    for (const system of Object.keys(data)) {
      for (const item of data[system]) {
        items.push({ ...item, system });
      }
    }
    return items;
  };

  const groupByUnit = (system, items, mainUnitItems, allItems) => {
    const units = items.reduce((acc, item) => {
      const unitKey = `${item.unit.trim()}/${item.contour.trim()}`;
	  
	  if (item.unit.trim() === "STU" && system.trim() === "BISCERT") {
      return acc; // Skip adding this unit
	  }
	  
      if (!acc[unitKey]) {
        acc[unitKey] = [];
      }
      acc[unitKey].push(item);
      return acc;
    }, {});

    let filteredUnits = Object.keys(units).filter((unitKey) => {
      if (!showInstalledOnly) return true;
      const status = unitOptions.find((u) => u.unitKey === unitKey)?.status || '';
      return status === 'Installed';
    });

    const [mainUnitName, mainUnitContour] = mainUnit.split('/');

    // Exclude the main unit's contour from the contour order
    const contourOrderExcludingMain = contourOrder.filter(
      (contour) => contour !== mainUnitContour
    );

    // Sorting units
    filteredUnits = filteredUnits.sort((a, b) => {
      if (a === mainUnit) return -1;
      if (b === mainUnit) return 1;

      const [unitA, contourA] = a.split('/');
      const [unitB, contourB] = b.split('/');

      const aIsSameContour = contourA === mainUnitContour;
      const bIsSameContour = contourB === mainUnitContour;

      if (aIsSameContour && !bIsSameContour) return -1;
      if (!aIsSameContour && bIsSameContour) return 1;

      const contourPriorityA = contourOrderExcludingMain.indexOf(contourA);
      const contourPriorityB = contourOrderExcludingMain.indexOf(contourB);

      if (contourPriorityA !== contourPriorityB) {
        if (contourPriorityA === -1) return 1;
        if (contourPriorityB === -1) return -1;
        return contourPriorityA - contourPriorityB;
      }

      // If contours are the same, sort by unit name
      return unitA.localeCompare(unitB);
    });

    return filteredUnits.map((unitKey) => {
      const status = unitOptions.find((u) => u.unitKey === unitKey)?.status || '';
      return renderUnitTable(unitKey, units[unitKey], mainUnitItems, allItems, status);
    });
  };

  const handleMainUnitChange = (e) => {
    const selectedUnit = e.target.value;
    setMainUnit(selectedUnit);
    // mainSystem will be updated via useEffect
  };

  const handleContourChange = (e) => {
    const value = e.target.value;
    const checked = e.target.checked;

    setContours((prevContours) => {
      if (checked) {
        // Add the selected contour
        return [...prevContours, value];
      } else {
        // Remove the unselected contour
        return prevContours.filter((contour) => contour !== value);
      }
    });
  };

  return (
    <div className="ViewMVL">
      <h1>View MVL</h1>

      <div className="controls">
        <div className="input-group">
          <label htmlFor="mvlID">MVL ID:</label>
          <input
            type="text"
            id="mvlID"
            value={mvlID}
            onChange={(e) => setMvlID(e.target.value)}
            placeholder="Enter MVL ID"
          />
        </div>
        <div className="input-group">
          <label>Contour:</label>
          <div className="checkbox-group">
            <label>
              <input
                type="checkbox"
                value="PROD"
                checked={contours.includes('PROD')}
                onChange={handleContourChange}
              />
              PROD
            </label>
            <label>
              <input
                type="checkbox"
                value="TEST"
                checked={contours.includes('TEST')}
                onChange={handleContourChange}
              />
              TEST
            </label>
            <label>
              <input
                type="checkbox"
                value="CERT"
                checked={contours.includes('CERT')}
                onChange={handleContourChange}
              />
              CERT
            </label>
          </div>
        </div>
        <div className="input-group">
          <label htmlFor="mainUnit">Main Unit:</label>
          <select id="mainUnit" value={mainUnit} onChange={handleMainUnitChange}>
            {filteredUnitOptions.map(({ unitKey, status }, index) => (
              <option key={index} value={unitKey}>
                {unitKey} ({status})
              </option>
            ))}
          </select>
        </div>
        <div className="input-group">
          <input
            type="checkbox"
            id="showInstalled"
            checked={showInstalledOnly}
            onChange={(e) => setShowInstalledOnly(e.target.checked)}
          />
          <label htmlFor="showInstalled">Show installed only</label>
        </div>
        <button onClick={handleSearch}>Search</button>
        <button onClick={() => setShowLegend(!showLegend)}>Legend</button>
      </div>

      {showLegend && (
        <div className="legend">
          <p>
            <span className="highlight-red">Red:</span> Module not in main unit
          </p>
          <p>
            <span className="highlight-orange">Orange:</span> Module only in main unit
          </p>
          <p>
            <span className="highlight">Yellow:</span> Field differs from main unit
          </p>
        </div>
      )}

      {loading && <div>Loading...</div>}
      {errorMessage && <div>{errorMessage}</div>}
      {data && renderTable(data)}
    </div>
  );
}

export default ViewMVL;
