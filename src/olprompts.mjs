import { SchemaType } from "@google/generative-ai";
export const getPrompts = () => {
  const systemInstruction = "You are creating a database with information about ads and extracting uploadable JSON data from callsheets and by searching the internet for additional information on the film described by the callsheet. Combine all pages in the input callsheet"
  const promptVariants = {
    "a": `1. Get the name, role, email, mobile number, telephone and company name for all crew members. 
      2. Get the name, role, mobile number, email and telephone for all the companies. 
      3. What is the film title, the synopsis and tag line? 
      4. Get the production info - production dates and location details. 
      5. Get all brands mentioned.
      6. Get all products mentioned.
      "7. awards": Get any awards won, who awarded them, the category and date of the award.
      8. Get the client name, email, mobile number, role, telephone and company`
  }

  const contact_details = {
    "type": SchemaType.OBJECT,
    "nullable": true,
    "properties": {
      "email": {
        "type": SchemaType.STRING,
        "description": "email address",
        "nullable": true,
      },
      "mobile": {
        "type": SchemaType.STRING,
        "description": "mobile number",
        "nullable": true,
      },
      "telephone": {
        "type": SchemaType.STRING,
        "description": "telephone number",
        "nullable": true,
      }
    }
  }

  const role = {
    "type": SchemaType.STRING,
    "description": "role in production",
    "nullable": true
  }

  const person_name = {
    "type":"string",
    "description": "person name",
    "nullable": true,
  }

  const company_name = {
    "type": SchemaType.STRING,
    "description": "company name",
    "nullable": true,
  }

  const client_name = {
    "type": SchemaType.STRING,
    "description": "client name",
    "nullable": true,
  }

  const schema = {
    "description": "Callsheet content",
    "type": SchemaType.ARRAY,
    "items": {
      "type": SchemaType.OBJECT,
      "properties": {
        "title": {
          "type": SchemaType.STRING,
          "description": "Film title",
          "nullable": true,
        },
        "synopsis": {
          "type": SchemaType.STRING,
          "description": "Film synopsis",
          "nullable": true,
        },
        "tag_line": {
          "type": SchemaType.STRING,
          "description": "Film tag line",
          "nullable": true,
        },
        "crew": {
          "type": SchemaType.ARRAY,
          "items": {
            "type": SchemaType.OBJECT,
            "properties": {
              person_name,
              role,
              "company_name":{
    "type": "string",
    "description": "company name",
    "nullable": true,
  },
              ...contact_details.properties,
            }
          }
        },
        "companies": {
          "type": SchemaType.ARRAY,
          "items": {
            "type": SchemaType.OBJECT,
            "properties": {
              "company_name":{
    "type": "string",
    "description": "company name",
    "nullable": true,
  },
              role,
              ...contact_details.properties,
            }
          }
        },
        "clients": {
          "type": SchemaType.ARRAY,
          "items": {
            "type": SchemaType.OBJECT,
            "properties": {
              client_name,
              role,
              ...contact_details.properties,
            }
          }
        },
        "production_info": {
          "type": SchemaType.OBJECT,
          "properties": {
            "location": {
              "type": SchemaType.STRING,
              "description": "filming location",
              "nullable": true
            },
            "production_dates": {
              "type": SchemaType.ARRAY,
              "items": {
                "type": SchemaType.STRING,
                "description": "production date",
                "nullable": true
              }
            },
            "other_info": {
              "type": SchemaType.STRING,
              "description": "other production info"
            }
          }
        },
        "brands": {
          "type": SchemaType.ARRAY,
          "items": {
            "type": SchemaType.OBJECT,
            "properties": {
              "name": {
                "type": SchemaType.STRING,
                "description": "brand name",
                "nullable": true
              }
            }
          }
        },
        "products": {
          "type": SchemaType.ARRAY,
          "items": {
            "type": SchemaType.OBJECT,
            "properties": {
              "name": {
                "type": SchemaType.STRING,
                "description": "product name",
                "nullable": true
              }
            }
          }
        },
        "awards": {
          "type": SchemaType.ARRAY,
          "items": {
            "type": SchemaType.OBJECT,
            "nullable": true,
            "properties": {
              "name": {
                "type": SchemaType.STRING,
                "description": "award name",
                "nullable": true,
              },
              "award_level": {
                "type": SchemaType.STRING,
                "description": "award level",
                "nullable": true,
              },
              "award_date": {
                "type": SchemaType.STRING,
                "description": "year or date of award",
                "nullable": true,
              },
              "award_body": {
                "type": SchemaType.STRING,
                "description": "who gave the award",
                "nullable": true,
              },
              "award_category": {
                "type": SchemaType.STRING,
                "description": "category of the award",
                "nullable": true,
              }
            }
          }
        },
      }
    }
  }

  return {
    schema,
    promptVariants,
    systemInstruction
  }

}