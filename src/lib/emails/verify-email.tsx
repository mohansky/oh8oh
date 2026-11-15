import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
  Button,
} from '@react-email/components'

interface VerifyEmailProps {
  name: string
  url: string
}

export function VerifyEmail({ name, url }: VerifyEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Verify your oh8oh email address</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Welcome to oh8oh!</Heading>
          <Text style={text}>Hi {name},</Text>
          <Text style={text}>
            Thanks for signing up. Please verify your email address to get
            started discovering events in Bangalore.
          </Text>
          <Section style={buttonContainer}>
            <Button style={button} href={url}>
              Verify Email
            </Button>
          </Section>
          <Text style={muted}>
            If you didn't create an account, you can safely ignore this email.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>oh8oh — Bangalore Events</Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: '#09090b',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}

const container = {
  margin: '0 auto',
  padding: '40px 24px',
  maxWidth: '480px',
}

const heading = {
  color: '#fafafa',
  fontSize: '24px',
  fontWeight: '600' as const,
  margin: '0 0 24px',
}

const text = {
  color: '#d4d4d8',
  fontSize: '15px',
  lineHeight: '24px',
  margin: '0 0 16px',
}

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '24px 0',
}

const button = {
  backgroundColor: '#fafafa',
  borderRadius: '6px',
  color: '#09090b',
  display: 'inline-block',
  fontSize: '15px',
  fontWeight: '600' as const,
  lineHeight: '100%',
  padding: '12px 24px',
  textDecoration: 'none',
}

const muted = {
  color: '#71717a',
  fontSize: '13px',
  lineHeight: '20px',
  margin: '0 0 16px',
}

const hr = {
  borderColor: '#27272a',
  margin: '24px 0',
}

const footer = {
  color: '#52525b',
  fontSize: '12px',
  margin: '0',
}
