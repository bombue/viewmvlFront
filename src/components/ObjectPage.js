import React, { useState } from 'react';
import axios from 'axios';
import './ObjectPage.css';

function ObjectPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('*ALL'); // Set default value to *ALL
  const [contours, setContours] = useState(['TEST']); // Changed from string to array
  const [unitOptions, setUnitOptions] = useState([]); // Store both unit and status
  const [errorMessage, setErrorMessage] = useState('');

  const handleSearch = () => {
    setLoading(true);
    setErrorMessage('');
    axios
      .get('http://localhost:9080/api/object/getInfo', {
        // .get('http://193.48.8.248:9080/api/object/getInfo', {
        params: {
          name: name,
          type: type,
          contour: contours.join(','), // Pass contours as comma-separated string
        },
      })
      .then((response) => {
        if (response.data && Object.keys(response.data).length > 0) {
          setData(response.data);
          updateUnitOptions(response.data); // Update unit options based on response data
        } else {
          setErrorMessage('No data found');
          setData(null);
          setUnitOptions([]); // Reset to default if no data is found
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
        setData(null); // Clear previous data if error occurs
      });
  };

  const updateUnitOptions = (data) => {
    // Extract distinct units and their statuses from the response JSON
    const unitStatusMap = new Map();
    for (const system of Object.keys(data)) {
      for (const item of data[system]) {
        const unit = item.unit.trim();
        const status = item.status.trim() === 'Y' ? 'Installed' : 'Not Installed'; // Convert state to Installed/Not Installed
        if (!unitStatusMap.has(unit)) {
          unitStatusMap.set(unit, status); // Map each unit to its status
        }
      }
    }

    // Convert the map to an array and update unitOptions state
    const unitsWithStatus = Array.from(unitStatusMap.entries()).map(([unit, status]) => ({
      unit,
      status,
    }));

    setUnitOptions(unitsWithStatus);
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

  const renderModules = (modules) => {
    return modules.map((module, index) => (
      <tr key={index}>
        <td colSpan="9"></td>
        <td>{module.name.trim()}</td>
        <td>{module.library.trim()}</td>
        <td>{module.changeDate}</td>
        <td>{module.changeTime}</td>
        <td>{module.sourceChangeDate}</td>
        <td>{module.sourceChangeTime}</td>
      </tr>
    ));
  };

  const renderUnitTable = (unit, items, status) => {
    return (
      <div key={unit}>
        <h3>
          Unit: {unit.trim()} ({status})
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
            {items.map((item, index) => (
              <React.Fragment key={index}>
                <tr>
                  <td>{item.unit.trim()}</td>
                  <td>{item.object.name.trim()}</td>
                  <td>{item.object.type.trim()}</td>
                  <td>{item.object.library.trim()}</td>
                  <td>{item.exists}</td>
                  <td>{item.changeDate}</td>
                  <td>{item.changeTime}</td>
                  <td>{item.sourceChangeDate}</td>
                  <td>{item.sourceChangeTime}</td>
                  <td colSpan="6"></td>
                </tr>
                {renderModules(item.modules)}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderTable = (data) => {
    return Object.keys(data).map((system) => (
      <div key={system}>
        <h2>System: {system.trim()}</h2>
        {groupByUnit(data[system])}
      </div>
    ));
  };

  const groupByUnit = (items) => {
    const units = items.reduce((acc, item) => {
      const unit = item.unit.trim();
      if (!acc[unit]) {
        acc[unit] = [];
      }
      acc[unit].push(item);
      return acc;
    }, {});

    const unitKeys = Object.keys(units);

    return unitKeys.map((unit) => {
      const status = unitOptions.find((u) => u.unit === unit)?.status || '';
      return renderUnitTable(unit, units[unit], status);
    });
  };

  return (
    <div className="ObjectPage">
      <h1>View Object Info</h1>
      <div className="controls">
        <div className="input-group">
          <label htmlFor="name">Object Name:</label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter object name"
          />
        </div>
        <div className="input-group">
          <label htmlFor="type">Object Type:</label>
          <input
            type="text"
            id="type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder="Enter object type"
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
        <button onClick={handleSearch}>Search</button>
      </div>
      {loading && <div>Loading...</div>}
      {errorMessage && <div>{errorMessage}</div>}
      {data && renderTable(data)}
    </div>
  );
}

export default ObjectPage;
