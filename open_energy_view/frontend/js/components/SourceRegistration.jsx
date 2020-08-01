import React, { useState, useEffect } from "react";
import cookie from "react-cookies";
import { Form, Button, DropdownButton, Dropdown } from "react-bootstrap";
import { addPgeSource } from "../api/DatabaseService";

const SourceRegistration = ({ history, restrictView }) => {
  const [form, setForm] = useState("");
  const [name, setName] = useState("");
  const [thirdPartyId, setThirdPartyId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  // TODO: server will respond 500 on failing UniqueConstraint for
  // "Provider ID" (third party ID) or name - update UI on promise reject

  const handleSubmit = (e) => {
    e.preventDefault();
    const regInfo = {
      name: name,
      thirdPartyId: thirdPartyId,
      clientId: clientId,
      clientSecret: clientSecret,
    };
    addPgeSource(regInfo).then(() => {
      restrictView();
      history.push("/");
    });
  };

  const handlePgeOAuth = () => {};

  const initialForm = (
    <div className="register-box">
      <Form.Text className="form-title">Add New Data Source</Form.Text>
      <hr />
      <DropdownButton
        onSelect={(e) => showPge(e)}
        id="dropdown-basic-button"
        title="Select Source"
      >
        <Dropdown.Item eventKey="pge">PG&E</Dropdown.Item>
      </DropdownButton>
    </div>
  );

  const selfAccess = <div className="register-box">
  <Form onSubmit={handleSubmit}>
    <Form.Text className="form-title">PG&E Share My Data</Form.Text>
    <Form.Text className="form-title">Self Access</Form.Text>
    <Form.Group controlId="formPge">
      <Form.Label>Name</Form.Label>
      <Form.Control
        className="login-form"
        type="text"
        placeholder="Name, like PG&E or Home PG&E"
        onChange={(e) => setName(e.target.value)}
      />
      <Form.Label>Third-Party ID</Form.Label>
      <Form.Control
        className="login-form"
        type="text"
        placeholder="Third-Party ID"
        onChange={(e) => setThirdPartyId(e.target.value)}
      />
      <Form.Label>Client ID</Form.Label>
      <Form.Control
        className="login-form"
        type="text"
        placeholder="Client ID"
        onChange={(e) => setClientId(e.target.value)}
      />
      <Form.Label>Client Secret</Form.Label>
      <Form.Control
        className="login-form"
        type="text"
        placeholder="Client Secret"
        onChange={(e) => setClientSecret(e.target.value)}
      />
    </Form.Group>
    <Button variant="primary" type="submit">
      Add Source
    </Button>
    <hr />
  </Form>
</div>

  return (
    <>
    {selfAccess}
      <Button variant="primary" onClick={handlePgeOAuth}>Add PG&E Account</Button>
    </>
    
  );
};

export default SourceRegistration;
